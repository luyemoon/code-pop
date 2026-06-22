import React from 'react';

interface NativeDialogProps {
  type: 'open' | 'save' | 'message';
  options?: Electron.OpenDialogOptions | Electron.SaveDialogOptions | Electron.MessageBoxOptions;
  onResult: (result: Electron.OpenDialogReturnValue | Electron.SaveDialogReturnValue | Electron.MessageBoxReturnValue) => void;
}

export const NativeDialog: React.FC<NativeDialogProps> = ({ type, options, onResult }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    setIsOpen(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const showDialog = async () => {
      try {
        let result: Electron.OpenDialogReturnValue | Electron.SaveDialogReturnValue | Electron.MessageBoxReturnValue;

        if (type === 'open' && window.electron?.showOpenDialog) {
          result = await window.electron.showOpenDialog(options as Electron.OpenDialogOptions);
        } else if (type === 'save' && window.electron?.showSaveDialog) {
          result = await window.electron.showSaveDialog(options as Electron.SaveDialogOptions);
        } else if (type === 'message' && window.electron?.showMessageBox) {
          result = await window.electron.showMessageBox(options as Electron.MessageBoxOptions);
        } else {
          throw new Error('Electron API not available');
        }

        onResult(result);
      } catch (error) {
        console.error('Dialog error:', error);
      } finally {
        setIsOpen(false);
      }
    };

    showDialog();
  }, [isOpen, type, options, onResult]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="native-dialog-overlay">
      <div className="native-dialog-content">
        <div className="loading-indicator">加载中...</div>
      </div>
    </div>
  );
};
