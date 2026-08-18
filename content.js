// content.js

let localData = null;

// local_data.json を読み込む関数
async function loadLocalData() {
  try {
    const url = chrome.runtime.getURL('local_data.json');
    const response = await fetch(url);
    localData = await response.json();
    return localData;
  } catch (error) {
    console.error('local_data.json の読み込みに失敗しました:', error);
    return null;
  }
}

// UIの追加（絞り込み用セレクトボックス）
function injectCustomUI() {
  const sortContainer = document.querySelector('select')?.parentElement?.parentElement;
  if (!sortContainer || document.getElementById('custom-filter-ui')) return;

  const customContainer = document.createElement('div');
  customContainer.id = 'custom-filter-ui';
  customContainer.className = 'flex items-center relative h-8 pl-3 pr-2.5 gap-x-px md:gap-x-0.5 font-semibold transition-colors border text-3xs md:text-sm rounded-2xl border-purple/10 hover:bg-purple/10 text-purple ml-2';
  
  const customLabel = document.createElement('span');
  customLabel.textContent = '女優・監督';
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
function filterByActress(aliasId) {
  if (!localData) return;

  const articles = document.querySelectorAll('article');
  
  articles.forEach(article => {
    const link = article.querySelector('a[data-testid="PackageCard"]');
    if (!link) return;
    
    const pidMatch = link.getAttribute('href').match(/pid=([^&]+)/);
    if (!pidMatch) return;
    
    const pid = pidMatch[1];
    const packageInfo = localData.packages[pid];
    const aliases = packageInfo ? packageInfo.aliases : [];
    
    // 選択されたIDが含まれているか、空（すべて）なら表示
    if (aliasId === "" || aliases.includes(aliasId)) {
      article.style.display = '';
    } else {
      article.style.display = 'none';
    }
  });
}

// メイン処理
async function init() {
  const data = await loadLocalData();
  if (!data) return;

  injectCustomUI();

  const selectElement = document.querySelector('#custom-filter-ui select');
  if (!selectElement) return;

  // 辞書から女優・監督名（aliasId -> 名前）を取得し、50音順にソートして選択肢に追加
  const aliasDict = data.dictionaries?.aliases || {};
  const sortedAliases = Object.entries(aliasDict).sort((a, b) => a[1].localeCompare(b[1], 'ja'));

  sortedAliases.forEach(([aliasId, name]) => {
    const option = document.createElement('option');
    option.value = aliasId;
    option.textContent = name;
    selectElement.appendChild(option);
  });
}

setTimeout(init, 1000);