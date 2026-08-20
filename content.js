// content.js
let localData = null; // local_data.jsonのデータを保持
let currentSelectedAliasId = ""; // 現在選択されている絞り込みIDを保持

async function loadLocalData() {
  try {
    const url = chrome.runtime.getURL('local_data.json');
    const response = await fetch(url);
    localData = await response.json();
    return localData;
  } catch (error) {
    console.error('local_data.jsonの読み込みエラー:', error);
    return null;
  }
}

function injectCustomUI() {
  const sortContainer = document.querySelector('select')?.parentElement?.parentElement;
  if (!sortContainer || document.getElementById('custom-filter-ui')) return;

  const customContainer = document.createElement('div');
  customContainer.id = 'custom-filter-ui';
  customContainer.className = 'flex items-center relative h-8 pl-3 pr-2.5 gap-x-px md:gap-x-0.5 font-semibold transition-colors border text-3xs md:text-sm rounded-2xl border-purple/10 hover:bg-purple/10 text-purple ml-2';

  const customLabel = document.createElement('span');
  customLabel.textContent = '絞り込み';
  customLabel.id = 'custom-filter-label';

  const customSelect = document.createElement('select');
  customSelect.className = 'absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer';
  customSelect.innerHTML = `<option value="">指定なし</option>`;

  customSelect.addEventListener('change', (e) => {
    filterByActress(e.target.value);
  });

  customContainer.appendChild(customLabel);
  customContainer.appendChild(customSelect);
  sortContainer.appendChild(customContainer);
}

function filterByActress(aliasId) {
  // 引数が指定された場合は現在選択されているIDを更新
  if (aliasId !== undefined) {
    currentSelectedAliasId = aliasId;
  }

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

    // 選択された女優が含まれていれば表示、それ以外は非表示
    if (currentSelectedAliasId === "" || aliases.includes(currentSelectedAliasId)) {
      article.style.display = '';
    } else {
      article.style.display = 'none';
    }
  });
}

// スクロール等による動的DOM追加を監視し、選択中の条件で再絞り込みを行う関数
function observeDOMChanges() {
  const targetNode = document.querySelector('section') || document.body;
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    // 新しい要素が追加された場合のみ絞り込みを再適用
    if (hasNewNodes && currentSelectedAliasId !== "") {
      filterByActress(currentSelectedAliasId);
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });
}

async function init() {
  const data = await loadLocalData();
  if (!data) return;

  injectCustomUI();
  observeDOMChanges(); // スクロールによる要素追加の監視を開始

  const selectElement = document.querySelector('#custom-filter-ui select');
  if (!selectElement) return;

  // aliasId -> 女優名のマッピングでドロップダウン生成
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