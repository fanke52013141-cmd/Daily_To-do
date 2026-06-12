// ==========================================================================
// AI 待办 - 渲染进程交互逻辑 (极简线稿重构版)
// ==========================================================================

// 默认应用状态数据 (纯文字和统一黑白线稿)
const DEFAULT_STATE = {
  groups: [
    {
      id: 'g-default',
      name: '默认分组',
      todos: [
        { id: 't-1', text: '双击文字即可原地修改内容', completed: false },
        { id: 't-2', text: '点击左边方框用红线划掉待办', completed: false },
        { id: 't-3', text: '点击顶部齿轮按钮可以调节字号和背景色', completed: false },
        { id: 't-4', text: '点击最右侧的按钮可以把窗口折叠成桌面小挂件', completed: true }
      ]
    }
  ],
  config: {
    fontScale: 1.0,
    bgColor: '#fdfdfd',
    isCollapsed: false,
    isSettingsOpen: false
  }
};

let appState = JSON.parse(JSON.stringify(DEFAULT_STATE));

// 原地修改状态记录
let editingGroupId = null;
let editingTodoId = null;

// SVG 代码常量 (干净的线稿图标，不再有抖动)
const SVG_ICONS = {
  ADD_TODO: `
    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  `,
  EDIT: `
    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  `,
  DELETE: `
    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `,
  TRASH: `
    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  `
};

// ==========================================================================
// 1. 数据持久化 (LocalStorage)
// ==========================================================================
function loadData() {
  try {
    const rawData = localStorage.getItem('ai_todo_state');
    if (rawData) {
      const parsed = JSON.parse(rawData);
      if (parsed.groups && Array.isArray(parsed.groups)) {
        appState.groups = parsed.groups;
      }
      if (parsed.config) {
        appState.config = { ...appState.config, ...parsed.config };
      }
    }
  } catch (e) {
    console.error('加载本地数据失败：', e);
  }
}

function saveData() {
  try {
    localStorage.setItem('ai_todo_state', JSON.stringify(appState));
  } catch (e) {
    console.error('保存数据失败：', e);
  }
}

// ==========================================================================
// 2. 窗口控制绑定
// ==========================================================================
function initWindowControls() {
  const minimizeBtn = document.getElementById('minimizeBtn');
  const closeBtn = document.getElementById('closeBtn');
  const collapseBtn = document.getElementById('collapseBtn');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const settingsToggleBtn = document.getElementById('settingsToggleBtn');

  const isElectron = window.windowAPI !== undefined;

  createGroupBtn.addEventListener('click', createGroup);
  
  settingsToggleBtn.addEventListener('click', () => {
    appState.config.isSettingsOpen = !appState.config.isSettingsOpen;
    updateSettingsUI();
    saveData();
  });



  if (isElectron) {
    minimizeBtn.addEventListener('click', () => window.windowAPI.minimize());
    closeBtn.addEventListener('click', () => window.windowAPI.close());
    
    collapseBtn.addEventListener('click', () => {
      appState.config.isCollapsed = !appState.config.isCollapsed;
      updateCollapseUI();
      window.windowAPI.collapse(appState.config.isCollapsed);
      saveData();
    });
  } else {
    minimizeBtn.addEventListener('click', () => alert('最小化 (仅在本地客户端可用)'));
    closeBtn.addEventListener('click', () => alert('关闭 (仅在本地客户端可用)'));
    
    collapseBtn.addEventListener('click', () => {
      appState.config.isCollapsed = !appState.config.isCollapsed;
      updateCollapseUI();
      saveData();
    });
  }
}

function updateCollapseUI() {
  const appContainer = document.getElementById('appContainer');
  const isCollapsed = appState.config.isCollapsed;

  if (isCollapsed) {
    appContainer.classList.add('collapsed');
  } else {
    appContainer.classList.remove('collapsed');
  }
}

function updateSettingsUI() {
  const settingsDropdown = document.getElementById('settingsDropdown');
  const settingsToggleBtn = document.getElementById('settingsToggleBtn');
  const isOpen = appState.config.isSettingsOpen;

  if (isOpen) {
    settingsDropdown.classList.add('open');
    settingsToggleBtn.style.backgroundColor = '#eeeeee';
    settingsToggleBtn.style.borderColor = '#222222';
  } else {
    settingsDropdown.classList.remove('open');
    settingsToggleBtn.style.backgroundColor = 'transparent';
    settingsToggleBtn.style.borderColor = 'transparent';
  }
}

// ==========================================================================
// 3. 配置控制绑定 (背景色与字号)
// ==========================================================================
function initConfigControls() {
  const fontScaleRange = document.getElementById('fontScaleRange');
  const fontScaleValue = document.getElementById('fontScaleValue');
  const bgColorPicker = document.getElementById('bgColorPicker');
  const presetButtons = document.querySelectorAll('.color-preset');

  const applyFontScale = (scale) => {
    document.documentElement.style.setProperty('--font-scale', scale);
    fontScaleValue.textContent = `${Math.round(scale * 100)}%`;
  };

  fontScaleRange.value = appState.config.fontScale;
  applyFontScale(appState.config.fontScale);

  fontScaleRange.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    appState.config.fontScale = scale;
    applyFontScale(scale);
    saveData();
  });

  const applyBgColor = (color) => {
    appState.config.bgColor = color;
    document.documentElement.style.setProperty('--bg-color', color);
    bgColorPicker.value = color;

    presetButtons.forEach(btn => {
      if (btn.getAttribute('data-color').toLowerCase() === color.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const isDefaultBg = color.toLowerCase() === '#fdfdfd';
    if (!isDefaultBg) {
      document.body.classList.add('has-custom-bg');
    } else {
      document.body.classList.remove('has-custom-bg');
    }
  };

  applyBgColor(appState.config.bgColor);

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      applyBgColor(color);
      saveData();
    });
  });

  bgColorPicker.addEventListener('input', (e) => {
    applyBgColor(e.target.value);
  });

  bgColorPicker.addEventListener('change', (e) => {
    applyBgColor(e.target.value);
    saveData();
  });
}

// ==========================================================================
// 4. 分组与待办 CRUD 逻辑
// ==========================================================================

function createGroup() {
  const id = `g-${Date.now()}`;
  appState.groups.push({
    id: id,
    name: '新建分组',
    todos: []
  });
  editingGroupId = id; // 默认进入编辑状态
  saveData();
  render();
}

function deleteGroup(groupId) {
  if (confirm('确定要删除这个分组吗？分组下的所有待办也将被清空。')) {
    appState.groups = appState.groups.filter(g => g.id !== groupId);
    saveData();
    render();
  }
}

// 直接在右上角点击 + 触发的原增待办逻辑，并原地进入编辑聚焦
function addTodoInline(groupId) {
  const group = appState.groups.find(g => g.id === groupId);
  if (group) {
    const newTodoId = `t-${Date.now()}`;
    group.todos.push({
      id: newTodoId,
      text: '新待办事项', // 默认占位字符
      completed: false
    });
    editingTodoId = newTodoId; // 使该新待办立刻进入编辑聚焦
    saveData();
    render();
  }
}

function deleteTodo(groupId, todoId) {
  const group = appState.groups.find(g => g.id === groupId);
  if (group) {
    group.todos = group.todos.filter(t => t.id !== todoId);
    saveData();
    render();
  }
}

function toggleTodo(groupId, todoId) {
  const group = appState.groups.find(g => g.id === groupId);
  if (group) {
    const todo = group.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      saveData();
      render();
    }
  }
}

function saveTitleEdit(type, id, newValue) {
  const val = newValue.trim();
  if (!val) return;

  if (type === 'group') {
    const group = appState.groups.find(g => g.id === id);
    if (group) group.name = val;
    editingGroupId = null;
  } else if (type === 'todo') {
    for (let group of appState.groups) {
      const todo = group.todos.find(t => t.id === id);
      if (todo) {
        todo.text = val;
        break;
      }
    }
    editingTodoId = null;
  }
  saveData();
  render();
}

// ==========================================================================
// 5. 渲染 DOM 核心方法
// ==========================================================================
function render() {
  const container = document.getElementById('groupsContainer');
  container.innerHTML = '';

  appState.groups.forEach(group => {
    // 5.1 创建卡片
    const groupCard = document.createElement('div');
    groupCard.className = 'group-card';

    // 5.2 构建头部
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';

    const titleArea = document.createElement('div');
    titleArea.className = 'group-title-area';

    if (editingGroupId === group.id) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sketch-input group-title-input';
      input.value = group.name;
      
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);

      const handleSave = () => saveTitleEdit('group', group.id, input.value);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
          editingGroupId = null;
          render();
        }
      });
      input.addEventListener('blur', handleSave);

      titleArea.appendChild(input);
    } else {
      const titleSpan = document.createElement('span');
      titleSpan.className = 'group-title-text';
      titleSpan.textContent = group.name;
      titleSpan.addEventListener('dblclick', () => {
        editingGroupId = group.id;
        render();
      });

      titleArea.appendChild(titleSpan);

      // 编辑笔 SVG 图标
      const editIcon = document.createElement('button');
      editIcon.className = 'icon-btn';
      editIcon.innerHTML = SVG_ICONS.EDIT;
      editIcon.title = '重命名分组';
      editIcon.addEventListener('click', () => {
        editingGroupId = group.id;
        render();
      });
      titleArea.appendChild(editIcon);
    }

    // 分组操作按钮区
    const groupActions = document.createElement('div');
    groupActions.className = 'group-actions';

    // 1. 新建待办的加号按钮 (+) (在关闭按钮的左边，在 CSS 中用 gap: 12px 确保距离以防误触)
    const addTodoBtn = document.createElement('button');
    addTodoBtn.className = 'icon-btn';
    addTodoBtn.innerHTML = SVG_ICONS.ADD_TODO;
    addTodoBtn.title = '添加待办事项';
    addTodoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addTodoInline(group.id);
    });
    groupActions.appendChild(addTodoBtn);

    // 2. 删除当前分组按钮 (X)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.innerHTML = SVG_ICONS.DELETE;
    deleteBtn.title = '删除分组';
    deleteBtn.addEventListener('click', () => deleteGroup(group.id));
    groupActions.appendChild(deleteBtn);

    groupHeader.appendChild(titleArea);
    groupHeader.appendChild(groupActions);
    groupCard.appendChild(groupHeader);

    // 5.3 待办事项列表
    const todoList = document.createElement('div');
    todoList.className = 'todo-list';

    group.todos.forEach(todo => {
      const todoItem = document.createElement('div');
      todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;

      const itemLeft = document.createElement('div');
      itemLeft.className = 'todo-item-left';

      // 复选框
      const checkboxWrapper = document.createElement('label');
      checkboxWrapper.className = 'sketch-checkbox-wrapper';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.addEventListener('change', () => toggleTodo(group.id, todo.id));

      const checkboxSpan = document.createElement('span');
      checkboxSpan.className = 'sketch-checkbox';

      checkboxWrapper.appendChild(checkbox);
      checkboxWrapper.appendChild(checkboxSpan);
      itemLeft.appendChild(checkboxWrapper);

      // 编辑文本框或文本项
      if (editingTodoId === todo.id) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sketch-input todo-item-input';
        input.value = todo.text;

        setTimeout(() => {
          input.focus();
          input.select();
        }, 0);

        const handleSave = () => saveTitleEdit('todo', todo.id, input.value);

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            editingTodoId = null;
            render();
          }
        });
        input.addEventListener('blur', handleSave);

        itemLeft.appendChild(input);
      } else {
        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text';
        textSpan.textContent = todo.text;
        
        textSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          editingTodoId = todo.id;
          render();
        });

        itemLeft.appendChild(textSpan);

        // 编辑笔图标
        const editTodoIcon = document.createElement('button');
        editTodoIcon.className = 'icon-btn';
        editTodoIcon.innerHTML = SVG_ICONS.EDIT;
        editTodoIcon.title = '编辑待办';
        editTodoIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          editingTodoId = todo.id;
          render();
        });
        itemLeft.appendChild(editTodoIcon);
      }

      const itemRight = document.createElement('div');
      itemRight.className = 'todo-item-right';

      // 垃圾桶删除图标
      const deleteTodoBtn = document.createElement('button');
      deleteTodoBtn.className = 'icon-btn';
      deleteTodoBtn.innerHTML = SVG_ICONS.TRASH;
      deleteTodoBtn.title = '删除待办';
      deleteTodoBtn.addEventListener('click', () => deleteTodo(group.id, todo.id));

      itemRight.appendChild(deleteTodoBtn);

      todoItem.appendChild(itemLeft);
      todoItem.appendChild(itemRight);
      todoList.appendChild(todoItem);
    });

    groupCard.appendChild(todoList);
    container.appendChild(groupCard);
  });
}

// ==========================================================================
// 6. 初始化入口
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  initWindowControls();
  initConfigControls();
  
  // 应用上次的收缩状态
  updateCollapseUI();
  updateSettingsUI();

  if (appState.config.isCollapsed && window.windowAPI) {
    setTimeout(() => {
      window.windowAPI.collapse(true);
    }, 100);
  }

  // 首次渲染
  render();
});
