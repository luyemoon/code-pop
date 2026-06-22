import { describe, it, expect, beforeEach } from 'vitest';
import { CodeParser, defaultParser } from './parser';
import { detectLanguage, shouldSkipPath, isBinaryFile, getFileExtension, SUPPORTED_LANGUAGES } from './languages';

describe('CodeParser', () => {
  let parser: CodeParser;

  beforeEach(() => {
    parser = new CodeParser();
  });

  describe('constructor', () => {
    it('should create a new CodeParser instance', () => {
      expect(parser).toBeInstanceOf(CodeParser);
    });
  });

  describe('parseFile', () => {
    it('should return null for binary files', async () => {
      const result = await parser.parseFile('/path/to/image.png', 'binary content');
      expect(result).toBeNull();
    });

    it('should return null for skipped paths', async () => {
      const result = await parser.parseFile('/path/to/node_modules/package/index.js', 'const x = 1;');
      expect(result).toBeNull();
    });

    it('should return null for unsupported file types', async () => {
      const result = await parser.parseFile('/path/to/file.xyz', 'some content');
      expect(result).toBeNull();
    });

    it('should parse TypeScript files', async () => {
      const content = `
        export function hello(name: string): string {
          return \`Hello, \${name}\`;
        }
        
        export class MyClass {
          private value: number;
          
          constructor() {
            this.value = 42;
          }
        }
      `;

      const result = await parser.parseFile('/path/to/test.ts', content);

      expect(result).not.toBeNull();
      expect(result?.language).toBe('TypeScript');
      expect(result?.symbols.length).toBeGreaterThan(0);
    });

    it('should parse JavaScript files', async () => {
      const content = `
        function add(a, b) {
          return a + b;
        }
        
        const multiply = (a, b) => a * b;
        
        module.exports = { add, multiply };
      `;

      const result = await parser.parseFile('/path/to/test.js', content);

      expect(result).not.toBeNull();
      expect(result?.language).toBe('JavaScript');
    });

    it('should parse Python files', async () => {
      const content = `
def greet(name: str) -> str:
    return f"Hello, {name}"

class MyClass:
    def __init__(self):
        self.value = 42
`;

      const result = await parser.parseFile('/path/to/test.py', content);

      expect(result).not.toBeNull();
      expect(result?.language).toBe('Python');
    });

    it('should return parse result with chunks', async () => {
      const content = `
function functionOne() {
  return 1;
}

function functionTwo() {
  return 2;
}
`;

      const result = await parser.parseFile('/path/to/test.ts', content);

      expect(result).not.toBeNull();
      expect(result?.chunks).toBeDefined();
      expect(Array.isArray(result?.chunks)).toBe(true);
    });

    it('should calculate content hash', async () => {
      const content = 'const x = 1;';
      const result = await parser.parseFile('/path/to/test.ts', content);

      expect(result).not.toBeNull();
      expect(result?.contentHash).toBeDefined();
      expect(typeof result?.contentHash).toBe('string');
    });

    it('should calculate size in bytes', async () => {
      const content = 'const x = 1;';
      const result = await parser.parseFile('/path/to/test.ts', content);

      expect(result).not.toBeNull();
      expect(result?.sizeBytes).toBe(Buffer.byteLength(content, 'utf8'));
    });
  });

  describe('parseContent', () => {
    it('should parse content with specified language', async () => {
      const content = 'export function test() { return 42; }';
      const result = await parser.parseContent(content, 'typescript');

      expect(result).not.toBeNull();
      expect(result?.language).toBe('TypeScript');
    });

    it('should return null for unsupported language', async () => {
      const result = await parser.parseContent('some code', 'unsupported');
      expect(result).toBeNull();
    });

    it('should parse TypeScript content', async () => {
      const content = `
        interface User {
          name: string;
          age: number;
        }
        
        type UserCallback = (user: User) => void;
      `;

      const result = await parser.parseContent(content, 'typescript');

      expect(result).not.toBeNull();
      expect(result?.language).toBe('TypeScript');
    });

    it('should parse Python content', async () => {
      const content = `
        class MyClass:
            def __init__(self):
                pass
                
            def method(self):
                pass
      `;

      const result = await parser.parseContent(content, 'python');

      expect(result).not.toBeNull();
      expect(result?.language).toBe('Python');
    });

    it('should parse Go content', async () => {
      const content = `
        package main
        
        func main() {
            println("Hello")
        }
      `;

      const result = await parser.parseContent(content, 'go');

      expect(result).not.toBeNull();
      expect(result?.language).toBe('Go');
    });
  });
});

describe('defaultParser', () => {
  it('should be an instance of CodeParser', () => {
    expect(defaultParser).toBeInstanceOf(CodeParser);
  });
});

describe('Language Detection', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('test.ts')).not.toBeNull();
      expect(detectLanguage('test.ts')?.name).toBe('TypeScript');
    });

    it('should detect TypeScript React', () => {
      expect(detectLanguage('test.tsx')?.name).toBe('TypeScript');
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('test.js')?.name).toBe('JavaScript');
    });

    it('should detect Python', () => {
      expect(detectLanguage('test.py')?.name).toBe('Python');
    });

    it('should detect Go', () => {
      expect(detectLanguage('test.go')?.name).toBe('Go');
    });

    it('should detect Java', () => {
      expect(detectLanguage('test.java')?.name).toBe('Java');
    });

    it('should detect Rust', () => {
      expect(detectLanguage('test.rs')?.name).toBe('Rust');
    });

    it('should detect C++', () => {
      expect(detectLanguage('test.cpp')?.name).toBe('C++');
    });

    it('should detect C#', () => {
      expect(detectLanguage('test.cs')?.name).toBe('C#');
    });

    it('should return null for unknown extensions', () => {
      expect(detectLanguage('test.xyz')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(detectLanguage('test.TS')?.name).toBe('TypeScript');
      expect(detectLanguage('test.PY')?.name).toBe('Python');
    });
  });
});

describe('Path Handling', () => {
  describe('shouldSkipPath', () => {
    it('should skip node_modules', () => {
      expect(shouldSkipPath('/path/node_modules/package')).toBe(true);
    });

    it('should skip .git directory', () => {
      expect(shouldSkipPath('/path/.git/config')).toBe(true);
    });

    it('should skip dist directory', () => {
      expect(shouldSkipPath('/path/dist/bundle.js')).toBe(true);
    });

    it('should skip build directory', () => {
      expect(shouldSkipPath('/path/build/output')).toBe(true);
    });

    it('should skip lock files', () => {
      expect(shouldSkipPath('/path/package-lock.json')).toBe(true);
      expect(shouldSkipPath('/path/yarn.lock')).toBe(true);
    });

    it('should skip .DS_Store', () => {
      expect(shouldSkipPath('/path/.DS_Store')).toBe(true);
    });

    it('should not skip normal source files', () => {
      expect(shouldSkipPath('/path/src/index.ts')).toBe(false);
      expect(shouldSkipPath('/path/lib/main.py')).toBe(false);
    });
  });

  describe('isBinaryFile', () => {
    it('should identify image files as binary', () => {
      expect(isBinaryFile('image.png')).toBe(true);
      expect(isBinaryFile('photo.jpg')).toBe(true);
    });

    it('should identify compressed files as binary', () => {
      expect(isBinaryFile('archive.zip')).toBe(true);
      expect(isBinaryFile('data.tar.gz')).toBe(true);
    });

    it('should identify executable files as binary', () => {
      expect(isBinaryFile('program.exe')).toBe(true);
      expect(isBinaryFile('library.dll')).toBe(true);
    });

    it('should not identify source files as binary', () => {
      expect(isBinaryFile('source.ts')).toBe(false);
      expect(isBinaryFile('script.py')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should return extension with dot', () => {
      expect(getFileExtension('file.ts')).toBe('.ts');
      expect(getFileExtension('file.py')).toBe('.py');
    });

    it('should handle files without extension', () => {
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('should handle multiple dots in filename', () => {
      expect(getFileExtension('test.module.ts')).toBe('.ts');
    });

    it('should handle paths', () => {
      expect(getFileExtension('/path/to/file.ts')).toBe('.ts');
    });
  });
});

describe('SUPPORTED_LANGUAGES', () => {
  it('should include TypeScript', () => {
    const ts = SUPPORTED_LANGUAGES.find(l => l.name === 'TypeScript');
    expect(ts).toBeDefined();
    expect(ts?.extensions).toContain('.ts');
    expect(ts?.extensions).toContain('.tsx');
  });

  it('should include Python', () => {
    const py = SUPPORTED_LANGUAGES.find(l => l.name === 'Python');
    expect(py).toBeDefined();
    expect(py?.extensions).toContain('.py');
  });

  it('should have tree-sitter language mappings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.treeSitterLanguage).toBeDefined();
    }
  });

  it('should have all expected languages', () => {
    const names = SUPPORTED_LANGUAGES.map(l => l.name);
    expect(names).toContain('TypeScript');
    expect(names).toContain('JavaScript');
    expect(names).toContain('Python');
    expect(names).toContain('Go');
    expect(names).toContain('Java');
    expect(names).toContain('Rust');
    expect(names).toContain('C++');
    expect(names).toContain('C#');
  });
});
