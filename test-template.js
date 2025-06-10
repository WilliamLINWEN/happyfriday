const { TemplateService } = require('./dist/server/services/template-service');

// 測試模板服務
const testData = {
  title: '測試 PR',
  description: '這是一個測試描述',
  author: 'test-user',
  repository: 'test-repo',
  sourceBranch: 'feature/test',
  destinationBranch: 'main',
  diff: '+ 新增的代碼\n- 刪除的代碼'
};

try {
  const result = TemplateService.formatPRDataForPrompt(testData);
  console.log('✅ 模板服務測試成功！');
  console.log('生成的 prompt 長度:', result.length);
  console.log('前100個字符:', result.substring(0, 100));
} catch (error) {
  console.error('❌ 模板服務測試失敗:', error.message);
}
