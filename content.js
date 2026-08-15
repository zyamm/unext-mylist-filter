// content.js

// 待機用のスリープ関数（ミリ秒指定）
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ストレージからキャッシュを取得
async function getCachedInfo(pid) {
  return new Promise(resolve => {
    chrome.storage.local.get([pid], (result) => {
      resolve(result[pid] || null);
    });
  });
}

// ストレージに情報をキャッシュ
async function setCachedInfo(pid, actresses) {
  return new Promise(resolve => {
    const data = {};
    data[pid] = actresses;
    chrome.storage.local.set(data, resolve);
  });
}

// 詳細ページから女優情報を取得する非同期関数
async function fetchActressInfo(pid) {
  // 1. まずローカルのキャッシュを確認
  const cachedData = await getCachedInfo(pid);
  if (cachedData) return cachedData;

  // 2. キャッシュがなければサーバーへ通信して取得
  try {
    const response = await fetch(`/library/mylist/package?pid=${pid}`);
    const text = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    // "-ALIAS" のリンクを持つ女優名を抽出
    const actressNodes = doc.querySelectorAll('a[href*="-ALIAS"] span.truncate');
    const actresses = Array.from(actressNodes).map(node => node.textContent.trim());
    
    // 取得した情報を保存し、サーバーへの負荷を下げるために1秒（1000ms）待機
    await setCachedInfo(pid, actresses);
    await sleep(1000); 
    
    return actresses;
  } catch (error) {
    console.error(`Failed to fetch info for ${pid}:`, error);
    return [];
  }
}

// UIの追加（絞り込み用セレクトボックス）
function injectCustomUI() {
  const sortContainer = document.querySelector('select').parentElement.parentElement;
  if (!sortContainer || document.getElementById('custom-filter-ui')) return;

  const customContainer = document.createElement('div');
  customContainer.id = 'custom-filter-ui';
  customContainer.className = 'flex items-center relative h-8 pl-3 pr-2.5 gap-x-px md:gap-x-0.5 font-semibold transition-colors border text-3xs md:text-sm rounded-2xl border-purple/10 hover:bg-purple/10 text-purple ml-2';
  
  const customLabel = document.createElement('span');
  customLabel.textContent = '読込中...'; // 初期状態は読込中とする
  customLabel.id = 'custom-filter-label';
  
  const customSelect = document.createElement('select');
  customSelect.className = 'absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer';
  customSelect.innerHTML = `<option value="">すべて</option>`;
  
  customSelect.addEventListener('change', (e) => {
    filterByActress(e.target.value);
  });

  customContainer.appendChild(customLabel);
  customContainer.appendChild(customSelect);
  sortContainer.appendChild(customContainer);
}

// リストの絞り込み処理
async function filterByActress(actressName) {
  const articles = document.querySelectorAll('article');
  
  for (const article of articles) {
    const link = article.querySelector('a[data-testid="PackageCard"]');
    if (!link) continue;
    
    const pidMatch = link.getAttribute('href').match(/pid=([^&]+)/);
    if (!pidMatch) continue;
    
    const pid = pidMatch[1];
    const actresses = await getCachedInfo(pid) || [];
    
    if (actressName === "" || actresses.includes(actressName)) {
      article.style.display = '';
    } else {
      article.style.display = 'none';
    }
  }
}

// メイン処理
async function init() {
  injectCustomUI();

  const articles = document.querySelectorAll('article');
  const uniqueActresses = new Set();
  const selectElement = document.querySelector('#custom-filter-ui select');
  const labelElement = document.getElementById('custom-filter-label');

  let count = 0;

  // 1件ずつ順番に取得（キャッシュがあれば通信は発生しない）
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
          const option = document.createElement('option');
          option.value = actress;
          option.textContent = actress;
          if(selectElement) selectElement.appendChild(option);
        }
      });
    }
    
    count++;
    if (labelElement) {
      labelElement.textContent = `女優絞り込み (${count}/${articles.length})`;
    }
  }

  if (labelElement) {
    labelElement.textContent = '女優絞り込み';
  }
}

setTimeout(init, 2000);