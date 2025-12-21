// 调试智能排版功能
console.log('开始调试智能排版功能...');

// 1. 检查页面是否有富文本编辑器
const checkEditor = () => {
  const editors = document.querySelectorAll('.ProseMirror');
  console.log(`找到 ${editors.length} 个富文本编辑器`);

  if (editors.length > 0) {
    editors.forEach((editor, index) => {
      console.log(`编辑器 ${index + 1} 内容:`, editor.innerText);
    });
  }

  return editors.length > 0;
};

// 2. 查找AI智能排版按钮
const findFormatButton = () => {
  const buttons = document.querySelectorAll('button');
  const formatButton = Array.from(buttons).find(btn =>
    btn.textContent && btn.textContent.includes('AI 智能排版')
  );

  if (formatButton) {
    console.log('找到 AI 智能排版按钮');
    return formatButton;
  } else {
    console.error('未找到 AI 智能排版按钮');
    return null;
  }
};

// 3. 尝试点击按钮
const clickFormatButton = () => {
  const button = findFormatButton();
  if (button) {
    console.log('点击 AI 智能排版按钮...');
    button.click();

    // 检查对话框是否打开
    setTimeout(() => {
      const dialog = document.querySelector('[class*="fixed inset-0"]');
      if (dialog) {
        console.log('对话框已打开');

        // 查找格式化按钮
        const formatButtons = dialog.querySelectorAll('button');
        const applyButton = Array.from(formatButtons).find(btn =>
          btn.textContent && btn.textContent.includes('重新格式化')
        );

        if (applyButton) {
          console.log('找到重新格式化按钮');
        } else {
          console.log('未找到重新格式化按钮');
        }
      } else {
        console.error('对话框未打开');
      }
    }, 500);
  }
};

// 4. 测试格式转换函数
const testFormatConversion = () => {
  console.log('测试格式转换...');

  const testCases = [
    {
      name: '紧凑格式',
      input: '后端: 熟悉若干编程语言或服务框架 数据库: 了解常见数据库及调优思路',
      expected: 'paragraph'
    },
    {
      name: '段落格式',
      input: '<p>后端: 熟悉若干编程语言</p><p>数据库: 了解常见数据库</p>',
      expected: 'list'
    },
    {
      name: '列表格式',
      input: '<ul><li>后端: 熟悉编程语言</li><li>数据库: 了解调优</li></ul>',
      expected: 'paragraph'
    }
  ];

  testCases.forEach(test => {
    console.log(`\n测试 ${test.name}:`);
    console.log('输入:', test.input);
    console.log('期望转换到:', test.expected);
  });
};

// 执行调试
console.log('\n=== 1. 检查编辑器 ===');
checkEditor();

console.log('\n=== 2. 查找AI智能排版按钮 ===');
findFormatButton();

console.log('\n=== 3. 测试格式转换 ===');
testFormatConversion();

console.log('\n=== 调试完成 ===');
console.log('如果需要点击按钮测试，请运行: clickFormatButton()');

// 导出函数供手动调用
window.debugFormatting = {
  checkEditor,
  findFormatButton,
  clickFormatButton,
  testFormatConversion
};