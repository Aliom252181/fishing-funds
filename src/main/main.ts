/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build:main`, this file is compiled to
 * `./src/main.prod.js` using webpack. This gives us some performance wins.
 */

import { app, globalShortcut, ipcMain, nativeTheme, dialog, webContents, shell, TouchBar } from 'electron';
import windowStateKeeper from 'electron-window-state';
import Store from 'electron-store';
import { Menubar } from 'menubar';
import AppUpdater from './autoUpdater';
import { appIcon, generateWalletIcon } from './icon';
import { createTray } from './tray';
import { createMenubar, buildContextMenu } from './menubar';
import TouchBarManager from './touchbar';
import { lockSingleInstance, checkEnvTool, sendMessageToRenderer, setNativeTheme } from './util';
import * as Enums from '../renderer/utils/enums';

let mb: Menubar;
let openBackupFilePath = '';

async function init() {
  lockSingleInstance();
  await app.whenReady();
  await checkEnvTool();
  main();
}

function main() {
  const storage = new Store({ encryptionKey: '1zilc' });
  const tray = createTray();

  const mainWindowState = windowStateKeeper({
    defaultWidth: 325,
    defaultHeight: 768,
    maximize: false,
    fullScreen: false,
  });
  mb = createMenubar({ tray, mainWindowState });
  const appUpdater = new AppUpdater({ icon: appIcon, mb });
  const touchBarManager = new TouchBarManager([], mb);
  let contextMenu = buildContextMenu({ mb, appUpdater }, []);
  let activeHotkeys = '';
  const defaultTheme = storage.get('SYSTEM_SETTING.systemThemeSetting', Enums.SystemThemeType.Auto) as Enums.SystemThemeType;
  // mb.app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');

  // ipcMain 主进程相关监听
  ipcMain.handle('show-message-box', async (event, config) => {
    return dialog.showMessageBox(config);
  });
  ipcMain.handle('show-save-dialog', async (event, config) => {
    return dialog.showSaveDialog(config);
  });
  ipcMain.handle('show-open-dialog', async (event, config) => {
    return dialog.showOpenDialog(config);
  });
  ipcMain.handle('show-current-window', (event, config) => {
    mb.window?.show();
  });
  ipcMain.handle('get-should-use-dark-colors', (event, config) => {
    return nativeTheme.shouldUseDarkColors;
  });
  ipcMain.handle('set-native-theme-source', (event, config) => {
    setNativeTheme(config);
  });
  ipcMain.handle('set-login-item-settings', (event, config) => {
    app.setLoginItemSettings(config);
  });
  ipcMain.handle('app-quit', (event, config) => {
    app.quit();
  });
  ipcMain.handle('set-tray-content', (event, config) => {
    tray.setTitle(config);
  });
  ipcMain.handle('check-update', (event) => {
    appUpdater.checkUpdate('renderer');
  });
  ipcMain.handle('get-storage-config', async (event, config) => {
    return storage.get(config.key, config.init);
  });
  ipcMain.handle('set-storage-config', async (event, config) => {
    storage.set(config.key, config.value);
  });
  ipcMain.handle('delete-storage-config', async (event, config) => {
    storage.delete(config.key);
  });
  ipcMain.handle('cover-storage-config', async (event, config) => {
    storage.set(config.value);
  });
  ipcMain.handle('all-storage-config', async (event, config) => {
    return storage.store;
  });
  ipcMain.handle('registry-webview', (event, config) => {
    const contents = webContents.fromId(config);
    contents.setWindowOpenHandler(({ url }) => {
      sendMessageToRenderer(mb, 'webview-new-window', url);
      return { action: 'deny' };
    });
  });
  ipcMain.handle('resolve-proxy', (event, url) => {
    return mb.window?.webContents.session.resolveProxy(url);
  });
  ipcMain.handle('set-proxy', (event, config) => {
    return mb.window?.webContents.session.setProxy(config);
  });
  ipcMain.handle('update-tray-context-menu-wallets', (event, config) => {
    const menus = config.map((item: any) => ({
      ...item,
      icon: generateWalletIcon(item.iconIndex),
      click: () => sendMessageToRenderer(mb, 'change-current-wallet-code', item.id),
    }));
    contextMenu = buildContextMenu({ mb, appUpdater }, menus);
  });
  // touchbar 相关监听
  ipcMain.handle('update-touchbar-zindex', (event, config) => {
    touchBarManager.updateZindexItems(config);
  });
  ipcMain.handle('update-touchbar-wallet', (event, config) => {
    touchBarManager.updateWalletItems(config);
  });
  ipcMain.handle('update-touchbar-tab', (event, config) => {
    touchBarManager.updateTabItems(config);
  });
  ipcMain.handle('update-touchbar-eye-status', (event, config) => {
    touchBarManager.updateEysStatusItems(config);
  });
  ipcMain.handle('set-hotkey', (event, keys: string) => {
    if (keys === activeHotkeys) {
      return;
    }
    if (activeHotkeys) {
      globalShortcut.unregister(activeHotkeys.split(' + ').join('+'));
    }
    if (keys) {
      const accelerator = keys.split(' + ').join('+');
      const ret = globalShortcut.register(accelerator, () => {
        const isWindowVisible = mb.window?.isVisible();
        if (isWindowVisible) {
          mb.hideWindow();
        } else {
          mb.showWindow();
        }
      });
      if (ret) {
        // dialog.showMessageBox({ message: `${accelerator}快捷键设置成功`, type: 'info' });
      } else {
        const isRegistered = globalShortcut.isRegistered(accelerator);
        if (isRegistered) {
          dialog.showMessageBox({ message: `${accelerator}快捷键已被占用`, type: 'warning' });
        } else {
          dialog.showMessageBox({ message: `${accelerator}快捷键设置失败`, type: 'error' });
        }
      }
    }
    activeHotkeys = keys;
  });
  // menubar 相关监听
  mb.on('after-create-window', () => {
    // 设置系统色彩偏好
    setNativeTheme(defaultTheme);
    // 系统级别高斯模糊
    if (process.platform === 'darwin') {
      mb.window?.setVibrancy('sidebar');
    }
    // 右键菜单
    tray.on('right-click', () => {
      mb.tray.popUpContextMenu(contextMenu);
    });
    // 监听主题颜色变化
    nativeTheme.on('updated', () => {
      sendMessageToRenderer(mb, 'nativeTheme-updated', { darkMode: nativeTheme.shouldUseDarkColors });
    });
    // 存储窗口大小
    mainWindowState.manage(mb.window!);
    // 隐藏dock栏
    app.dock?.hide();
    // 是否打开备份文件
    if (openBackupFilePath) {
      sendMessageToRenderer(mb, 'open-backup-file', openBackupFilePath);
    }
    // 外部打开 _blank连接
    mb.window?.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  });
  // 打开开发者工具
  if (!app.isPackaged) {
    mb.window?.webContents.openDevTools({ mode: 'undocked' });
  }

  // mb.on('ready', () => {
  //   // mb.window?.setVisibleOnAllWorkspaces(true);
  // });
  // new AppUpdater({ icon: nativeIcon, win: mb.window });
}

// app 相关监听
app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('browser-window-focus', () => {
  if (app.isPackaged) {
    globalShortcut.register('CommandOrControl+Shift+R', () => {});
    globalShortcut.register('CommandOrControl+R', () => {});
    globalShortcut.register('F5', () => {});
  }
});
app.on('browser-window-blur', () => {
  if (app.isPackaged) {
    globalShortcut.unregister('CommandOrControl+R');
    globalShortcut.unregister('F5');
    globalShortcut.unregister('CommandOrControl+Shift+R');
  }
});
app.on('second-instance', (event, argv, cwd) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mb.window) {
    if (mb.window.isMinimized()) mb.window.restore();
    mb.window.focus();
  }
});
app.on('open-file', (even, path: string) => {
  if (mb?.window) {
    sendMessageToRenderer(mb, 'open-backup-file', path);
  } else {
    openBackupFilePath = path;
  }
});
app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});
init().catch(console.log);
