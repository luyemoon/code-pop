import { LanguageConfig, detectLanguage, shouldSkipPath, isBinaryFile } from './languages';
import * as ts from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Go from 'tree-sitter-go';
import Java from 'tree-sitter-java';
import Rust from 'tree-sitter-rust';
import Cpp from 'tree-sitter-cpp';
import CSharp from 'tree-sitter-c-sharp';

export interface ParsedSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type' | 'enum' | 'method' | 'property' | 'unknown';
  kind: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  parentId?: string;
  isExported: boolean;
  children: ParsedSymbol[];
}

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  symbols: ParsedSymbol[];
  language: string;
  filePath: string;
}

export interface ParseResult {
  filePath: string;
  language: string;
  symbols: ParsedSymbol[];
  chunks: CodeChunk[];
  sizeBytes: number;
  contentHash: string;
}

type ParserInstance = {
  parse: (content: string, options?: { startPosition?: { row: number; column: number }; oldTree?: ts.Tree }) => ts.Tree;
};

const LANGUAGE_PARSERS: Map<string, ParserInstance> = new Map();

function getParser(language: string): ParserInstance | null {
  if (LANGUAGE_PARSERS.has(language)) {
    return LANGUAGE_PARSERS.get(language)!;
  }

  let parser: ParserInstance;

  switch (language) {
    case 'typescript':
    case 'javascript':
      parser = new ts.Parser();
      (parser as any).setLanguage(TypeScript);
      LANGUAGE_PARSERS.set('typescript', parser);
      LANGUAGE_PARSERS.set('javascript', parser);
      return parser;
    case 'python':
      parser = new ts.Parser();
      parser.setLanguage(Python);
      LANGUAGE_PARSERS.set('python', parser);
      return parser;
    case 'go':
      parser = new ts.Parser();
      parser.setLanguage(Go);
      LANGUAGE_PARSERS.set('go', parser);
      return parser;
    case 'java':
      parser = new ts.Parser();
      parser.setLanguage(Java);
      LANGUAGE_PARSERS.set('java', parser);
      return parser;
    case 'rust':
      parser = new ts.Parser();
      parser.setLanguage(Rust);
      LANGUAGE_PARSERS.set('rust', parser);
      return parser;
    case 'cpp':
    case 'c_sharp':
      parser = new ts.Parser();
      parser.setLanguage(Cpp);
      LANGUAGE_PARSERS.set('cpp', parser);
      LANGUAGE_PARSERS.set('c_sharp', parser);
      return parser;
    default:
      return null;
  }
}

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function extractSymbols(
  node: ts.SyntaxNode,
  parentId?: string
): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  const symbol = extractSymbolFromNode(node, parentId);
  
  if (symbol) {
    const currentId = `symbol_${node.id}`;
    symbols.push(symbol);
    
    const children: ParsedSymbol[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {
        children.push(...extractSymbols(child, currentId));
      }
    }
    symbol.children = children.filter(s => s.parentId === currentId);
    symbols.push(...children);
  } else {
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {
        symbols.push(...extractSymbols(child, parentId));
      }
    }
  }
  
  return symbols;
}

function extractSymbolFromNode(
  node: ts.SyntaxNode,
  parentId?: string
): ParsedSymbol | null {
  const type = getNodeSymbolType(node);
  if (!type) return null;

  const name = getNodeName(node);
  if (!name) return null;

  return {
    name,
    type: type.type,
    kind: type.kind,
    line: node.startPosition.row + 1,
    column: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
    parentId,
    isExported: isNodeExported(node),
    children: [],
  };
}

function getNodeSymbolType(node: ts.SyntaxNode): { type: ParsedSymbol['type']; kind: string } | null {
  const typeMap: Record<string, { type: ParsedSymbol['type']; kind: string }> = {
    function_declaration: { type: 'function', kind: 'function' },
    method_declaration: { type: 'method', kind: 'method' },
    class_declaration: { type: 'class', kind: 'class' },
    interface_declaration: { type: 'interface', kind: 'interface' },
    variable_declaration: { type: 'variable', kind: 'variable' },
    identifier: { type: 'variable', kind: 'variable' },
    type_alias_declaration: { type: 'type', kind: 'type' },
    enum_declaration: { type: 'enum', kind: 'enum' },
    property_declaration: { type: 'property', kind: 'property' },
    call_expression: { type: 'function', kind: 'function' },
    
    function_definition: { type: 'function', kind: 'function' },
    method_definition: { type: 'method', kind: 'method' },
    class_definition: { type: 'class', kind: 'class' },
    
    annotation_type_declaration: { type: 'class', kind: 'class' },
    interface_type_declaration: { type: 'interface', kind: 'interface' },
    
    module_declaration: { type: 'unknown', kind: 'module' },
  };

  return typeMap[node.type] || null;
}

function getNodeName(node: ts.SyntaxNode): string | null {
  switch (node.type) {
    case 'function_declaration':
    case 'method_declaration':
    case 'function_definition':
    case 'method_definition':
    case 'class_declaration':
    case 'class_definition':
    case 'interface_declaration':
    case 'interface_type_declaration':
    case 'type_alias_declaration':
    case 'enum_declaration':
      const nameChild = node.childForFieldName('name');
      if (nameChild) return nameChild.text;
      return null;
    
    case 'variable_declaration':
      const idChild = node.childForFieldName('name') || node.childForFieldName('identifier');
      if (idChild) return idChild.text;
      return null;
    
    case 'property_declaration':
    case 'property_definition':
      const propName = node.childForFieldName('name');
      if (propName) return propName.text;
      return null;
    
    case 'identifier':
      return node.text;
    
    default:
      return null;
  }
}

function isNodeExported(node: ts.SyntaxNode): boolean {
  switch (node.type) {
    case 'function_declaration':
    case 'class_declaration':
    case 'interface_declaration':
    case 'type_alias_declaration':
    case 'enum_declaration':
      const modifiers = node.childForFieldName('modifiers');
      if (modifiers) {
        return modifiers.text.includes('export') || modifiers.text.includes('pub');
      }
      return false;
    default:
      return false;
  }
}

function generateChunks(
  content: string,
  lines: string[],
  symbols: ParsedSymbol[],
  language: string,
  filePath: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  
  const functionSymbols = symbols.filter(
    s => s.type === 'function' || s.type === 'method' || s.type === 'class'
  );
  
  if (functionSymbols.length === 0) {
    const chunkSize = 200;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, Math.min(i + chunkSize, lines.length));
      const chunk: CodeChunk = {
        content: chunkLines.join('\n'),
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length),
        symbols: symbols.filter(
          s => s.line >= i + 1 && s.line <= Math.min(i + chunkSize, lines.length)
        ),
        language,
        filePath,
      };
      chunks.push(chunk);
    }
    return chunks;
  }
  
  const sortedSymbols = [...functionSymbols].sort((a, b) => a.line - b.line);
  
  for (const symbol of sortedSymbols) {
    const startLine = symbol.line - 1;
    const endLine = symbol.endLine ? symbol.endLine : Math.min(startLine + 100, lines.length);
    
    const chunkLines = lines.slice(startLine, endLine);
    const childSymbols = symbols.filter(
      s => s.line >= startLine + 1 && s.line <= endLine
    );
    
    chunks.push({
      content: chunkLines.join('\n'),
      startLine: startLine + 1,
      endLine,
      symbols: childSymbols,
      language,
      filePath,
    });
  }
  
  return chunks;
}

export class CodeParser {
  async parseFile(filePath: string, content: string): Promise<ParseResult | null> {
    if (shouldSkipPath(filePath)) {
      return null;
    }
    
    if (isBinaryFile(filePath)) {
      return null;
    }
    
    const langConfig = detectLanguage(filePath);
    if (!langConfig) {
      return null;
    }
    
    const parser = getParser(langConfig.treeSitterLanguage);
    if (!parser) {
      return null;
    }
    
    try {
      const tree = parser.parse(content);
      const rootNode = tree.rootNode;
      
      const symbols = extractSymbols(rootNode);
      
      const lines = content.split('\n');
      const chunks = generateChunks(content, lines, symbols, langConfig.name, filePath);
      
      return {
        filePath,
        language: langConfig.name,
        symbols,
        chunks,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        contentHash: computeHash(content),
      };
    } catch (error) {
      console.error(`Failed to parse file ${filePath}:`, error);
      return null;
    }
  }
  
  async parseContent(content: string, language: string): Promise<ParseResult | null> {
    const langConfig = SUPPORTED_LANGUAGES.find(
      l => l.name.toLowerCase() === language.toLowerCase()
    );
    
    if (!langConfig) {
      return null;
    }
    
    const parser = getParser(langConfig.treeSitterLanguage);
    if (!parser) {
      return null;
    }
    
    try {
      const tree = parser.parse(content);
      const rootNode = tree.rootNode;
      
      const symbols = extractSymbols(rootNode);
      const lines = content.split('\n');
      const chunks = generateChunks(content, lines, symbols, langConfig.name, '');
      
      return {
        filePath: '',
        language: langConfig.name,
        symbols,
        chunks,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        contentHash: computeHash(content),
      };
    } catch (error) {
      console.error(`Failed to parse content:`, error);
      return null;
    }
  }
}

import { SUPPORTED_LANGUAGES } from './languages';

export const defaultParser = new CodeParser();
