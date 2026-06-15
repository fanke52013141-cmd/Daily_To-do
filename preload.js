const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  collapse: (isCollapsed) => ipcRenderer.send('window-collapse', isCollapsed),
  setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.send('window-always-on-top', alwaysOnTop),
  enterBallMode: () => ipcRenderer.send('window-enter-ball-mode'),
  exitBallMode: (alwaysOnTop) => ipcRenderer.send('window-exit-ball-mode', alwaysOnTop),
  dragStart: () => ipcRenderer.send('window-drag-start'),
  dragEnd: () => ipcRenderer.send('window-drag-end'),
  moveWindow: (targetX, targetY) => ipcRenderer.send('window-move', { targetX, targetY }),
  setHeight: (height) => ipcRenderer.send('window-set-height', height),
  onUserResized: (callback) => ipcRenderer.on('user-resized', (event, height) => callback(height))
});
