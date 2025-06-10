# 專案名稱：Bitbucket PR 描述生成器
## 1. 專案概述
本專案旨在開發一個網頁應用，使用者可透過輸入 Bitbucket 的 repository（repo）和 Pull Request（PR）編號，讓後台調用 Bitbucket API 獲取 PR 的詳細資訊與程式碼差異（diff），並將這些資料傳送至大型語言模型（LLM）進行分析，最終生成 PR 描述並顯示在頁面上。

## 2. 目標
* 提供簡單易用的介面，讓使用者輸入 repo 和 PR 編號即可自動生成 PR 描述。
* 提升 PR 描述的品質與一致性，減少手動撰寫所需的時間與精力。

## 3. 功能需求
### 3.1 前端
* 使用者介面：
  * 一個表單，包含以下輸入欄位：
    * Repo：輸入 Bitbucket repository（格式：workspace/repo_slug）。
    * PR 編號：輸入 Pull Request 的編號。
    * 提交按鈕：用於觸發後台處理。
  * 一個顯示區域，用於呈現生成的 PR 描述。
* 互動設計：
  * 表單提交後，顯示「載入中」提示。
  * 處理完成後，顯示生成的 PR 描述；若失敗，顯示錯誤訊息。
### 3.2 後端
* API 整合：
  * 調用 Bitbucket API，獲取指定 PR 的詳細資訊與 diff。
  * 調用 LLM API，根據 PR 資訊生成描述。
    * 支援多種 LLM API，如 OpenAI API、Claude API、 Ollama API 等。
* 資料處理：
  * 接收前端傳來的 repo 和 PR 編號。
  * 將 Bitbucket API 回傳的資料整理後傳送至 LLM。
  * 將 LLM 生成的 PR 描述回傳至前端。
### 3.3 安全
* API 密鑰管理：
  * Bitbucket 和 LLM 的 API 密鑰儲存於環境變數中，避免硬編碼。
* 輸入驗證：
  * 檢查 repo 和 PR 編號是否為空。
  * 對於無效的 repo 或 PR 編號，返回清晰的錯誤訊息。
## 4. 非功能需求
* 性能：
  * 頁面初始載入時間不超過 2 秒。
  * API 調用與 LLM 處理總時間不超過 10 秒。
* 可用性：
  * 應用需相容於主流瀏覽器（Chrome、Firefox、Safari 的最新版本）。
* 可擴展性：
  * 後端需能處理多個並發請求。
* 安全性：
  * 所有 API 調用使用 HTTPS 協議。
  * 敏感資料（如 API 密鑰）不得儲存於客戶端。
## 5. 技術棧
* 前端：HTML, CSS, JavaScript。
* 後端：TypeScript, Express。
* API：
  * Bitbucket API（獲取 PR 資訊）。
  * OpenAI API 或其他 LLM API（生成描述）。
## 6. 開發流程
* 開發階段：
  1. 設置開發環境與工具。
  2. 設計並開發前端介面。
  3. 搭建後端伺服器。
  4. 整合 Bitbucket API。
  5. 整合 LLM API。
  6. 實現前端與後端的連通。
  7. 加入錯誤處理與輸入驗證。
  8. 進行測試。
* 測試計畫：
  * 單元測試：測試 API 調用與資料處理邏輯。
  * 整合測試：驗證前端與後端的互動是否順暢。
  * 使用者測試：確認功能的完整性與使用者體驗。

## 7. 附錄
* API 文檔：
  * Bitbucket API
  * OpenAI API
* 設計文件：
  * 前端介面設計草稿。
  * 後端系統架構圖。