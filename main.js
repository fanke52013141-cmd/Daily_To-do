const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
// 默认窗口大小
let normalSize = { width: 366, height: 650 };
let isCollapsed = false;

// 请求单实例锁，防止多实例运行以及后台残留僵尸进程导致的版本无法更新
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: normalSize.width,
      height: normalSize.height,
      minWidth: 280,
      minHeight: 100,
      frame: false, // 隐藏边框
      resizable: true,
      maximizable: false, // 禁用最大化，防止双击全屏
      show: false, // 避免加载时闪烁
      backgroundColor: '#ffffff',
      icon: path.join(__dirname, 'assets/icon.png'), // 加载手稿风格图标
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // 每次启动或重载前清除缓存，解决 Chromium 本地代码缓存导致修改不生效的问题
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.loadFile('index.html');
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // 实时记录展开状态下的窗口尺寸，以便折叠恢复时精准还原
    mainWindow.on('resize', () => {
      if (!isCollapsed && !mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
        const size = mainWindow.getSize();
        if (size[0] >= 280) {
          normalSize = { width: size[0], height: size[1] };
        }
      }
    });
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC 窗口控制事件处理
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-collapse', (event, collapseState) => {
  if (!mainWindow) return;
  isCollapsed = collapseState;

  if (isCollapsed) {
    // 折叠模式：折叠前如果最大化了，先取消最大化
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    const size = mainWindow.getSize();
    if (size[0] >= 280 && size[1] >= 100) {
      normalSize = { width: size[0], height: size[1] };
    }

    // 将窗口限制为仅显示标题栏的高度（这里设计为 40 像素，方便容纳 2px 粗边框）
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(normalSize.width, 40);
    mainWindow.setMaximumSize(normalSize.width, 40);
    mainWindow.setSize(normalSize.width, 40);
    // 自动置顶，便于桌面悬挂
    mainWindow.setAlwaysOnTop(true);
  } else {
    // 展开模式：解除限制，还原大小，取消置顶
    mainWindow.setMinimumSize(280, 100);
    mainWindow.setMaximumSize(9999, 9999);
    mainWindow.setResizable(true);
    mainWindow.setSize(normalSize.width, normalSize.height);
    mainWindow.setAlwaysOnTop(false);
  }
});
