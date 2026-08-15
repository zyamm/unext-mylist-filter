// content.js

// セキュリティ対策: HTML文字列のエスケープ処理
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, function(match) {
    const escape = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return escape[match];
  });
}

// 動画ごとの女優・監督情報をキャッシュするオブジェクト
const packageCache = {};

// 詳細ページから女優・監督情報を取得する非同期関数
async function fetchActressInfo(pid) {
  if (packageCache[pid]) return packageCache[pid];

  try {
    // 実際のURL構造に合わせてフェッチ（URLは推測です）
    const response = await fetch(`/library/mylist/package?pid=${pid}`);
    const text = await response.text();
    
    // DOMParserでHTMLを解析し、情報を抽出
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    // Elements_content.txt の構造に基づく抽出
    const actressNodes = doc.querySelectorAll('a[href*="-ALIAS"] span.truncate');
    const actresses = Array.from(actressNodes).map(node => node.textContent.trim());
    
    packageCache[pid] = actresses;
    return actresses;
  } catch (error) {
    console.error(`Failed to fetch info for ${pid}:`, error);
    return [];
  }
}

// UIの追加（絞り込み用セレクトボックス）
function injectCustomUI() {
  // 既存の「追加順」ボタン群の親要素を取得
  const sortContainer = document.querySelector('select').parentElement.parentElement;
  if (!sortContainer || document.getElementById('custom-filter-ui')) return;

  // コンテナを作成
  const customContainer = document.createElement('div');
  customContainer.id = 'custom-filter-ui';
  customContainer.className = 'flex items-center relative h-8 pl-3 pr-2.5 gap-x-px md:gap-x-0.5 font-semibold transition-colors border text-3xs md:text-sm rounded-2xl border-purple/10 hover:bg-purple/10 text-purple ml-2';
  
  const customLabel = document.createElement('span');
  customLabel.textContent = '女優絞り込み';
  
  const customSelect = document.createElement('select');
  customSelect.className = 'absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer';
  customSelect.innerHTML = `<option value="">すべて</option>`; // 初期オプション
  
  customSelect.addEventListener('change', (e) => {
    filterByActress(e.target.value);
  });

  customContainer.appendChild(customLabel);
  customContainer.appendChild(customSelect);
  sortContainer.appendChild(customContainer);
}

// リストの絞り込み処理
function filterByActress(actressName) {
  const articles = document.querySelectorAll('article');
  
  articles.forEach(article => {
    // aタグのhrefからpidを抽出
    const link = article.querySelector('a[data-testid="PackageCard"]');
    if (!link) return;
    
    const pidMatch = link.getAttribute('href').match(/pid=([^&]+)/);
    if (!pidMatch) return;
    const pid = pidMatch[1];

    const actresses = packageCache[pid] || [];
    
    // 選択された女優が含まれているか、空（すべて）なら表示
    if (actressName === "" || actresses.includes(actressName)) {
      article.style.display = '';
    } else {
      article.style.display = 'none';
    }
  });
}

// メイン処理の初期化
async function init() {
  injectCustomUI();

  // マイリスト上の全動画を取得
  const articles = document.querySelectorAll('article');
  const uniqueActresses = new Set();
  const selectElement = document.querySelector('#custom-filter-ui select');

  // 注意: 全件並列fetchはサーバーに負荷をかけるため、本来は直列やバッチ処理推奨
  for (const article of articles) {
    const link = article.querySelector('a[data-testid="PackageCard"]');
    if (!link) continue;
    
    const pidMatch = link.getAttribute('href').match(/pid=([^&]+)/);
    if (pidMatch) {
      const pid = pidMatch[1];
      const actresses = await fetchActressInfo(pid);
      
      actresses.forEach(actress => {
        if (!uniqueActresses.has(actress)) {
          uniqueActresses.add(actress);
          // セキュリティ: textContentを使用してXSSを防ぐ
          const option = document.createElement('option');
          option.value = actress;
          option.textContent = actress;
          if(selectElement) selectElement.appendChild(option);
        }
      });
    }
  }
}

// SPA（Single Page Application）対策として、少し遅延させて実行
setTimeout(init, 2000);