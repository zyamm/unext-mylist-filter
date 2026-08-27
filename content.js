// content.js
let localData = null; // local_data.jsonのデータを保持
let currentSelectedAliasId = ""; // 現在選択されている絞り込みIDを保持
const cardCache = new Map(); // pid -> article要素のクローンを保持するキャッシュ
let resizeObserver = null; // スタイル同期用のResizeObserver

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

// 現在DOM上にレンダリングされているカードをキャッシュに保存する関数
function cacheArticlesFromDOM() {
  const articles = document.querySelectorAll('article');
  articles.forEach(article => {
    const link = article.querySelector('a[data-testid="PackageCard"]');
    if (!link) return;

    const pidMatch = link.getAttribute('href')?.match(/pid=([^&]+)/);
    if (!pidMatch) return;

    const pid = pidMatch[1];
    if (!cardCache.has(pid)) {
      // 仮想スクロールによる削除に備え、要素を複製してキャッシュに保存
      const clone = article.cloneNode(true);
      clone.style.cssText = ''; // スタイルをクリア
      cardCache.set(pid, clone);
    }
  });
}

// まだ画面に描画されたことがないカードを全件自動収集するスキャン関数
async function scanAndCacheAllCards() {
  const totalPackages = Object.keys(localData?.packages || {}).length;
  if (totalPackages > 0 && cardCache.size >= totalPackages) {
    return;
  }

  showLoadingIndicator(true);

  const originalScrollY = window.scrollY;
  // 仮想スクロールの親コンテナから全高を取得
  const virtualContainer = document.querySelector('section > div > div');
  const totalHeight = virtualContainer ? parseFloat(virtualContainer.style.height) || document.body.scrollHeight : document.body.scrollHeight;
  const step = Math.floor(window.innerHeight * 0.8) || 600;

  // Reactの描画更新（150ms）を待ちながら全カードを順次キャッシュ
  for (let top = 0; top <= totalHeight; top += step) {
    window.scrollTo(0, top);
    await new Promise(resolve => setTimeout(resolve, 150));
    cacheArticlesFromDOM();
  }

  // スキャン完了後、元のスクロール位置に戻す
  window.scrollTo(0, originalScrollY);
  cacheArticlesFromDOM();

  showLoadingIndicator(false);
}

// 読み込み中インジケータの表示制御
function showLoadingIndicator(show) {
  let indicator = document.getElementById('filter-loading-indicator');
  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'filter-loading-indicator';
      indicator.className = 'fixed bottom-4 right-4 bg-purple text-white text-xs px-4 py-2 rounded-full shadow-lg z-[9999] flex items-center gap-2';
      indicator.innerHTML = '<span>カード情報を全件読み込み中...</span>';
      document.body.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  } else if (indicator) {
    indicator.style.display = 'none';
  }
}

// オリジナルの .grid から列数・余白のスタイルを取得してカスタムグリッドに流用・同期する関数
function syncGridStyle() {
  const customGrid = document.getElementById('custom-filter-grid');
  const originalGrid = document.querySelector('section article')?.parentElement;
  if (!customGrid || !originalGrid) return;

  // オリジナル要素のクラス名をそのまま流用
  customGrid.className = originalGrid.className;

  // 計算済みスタイルまたはインラインスタイルから列数や余白を取得して完全再現
  const computedStyle = window.getComputedStyle(originalGrid);
  const gridTemplateColumns = originalGrid.style.gridTemplateColumns || computedStyle.gridTemplateColumns;
  const columnGap = originalGrid.style.columnGap || computedStyle.columnGap || '12px';

  customGrid.style.gridTemplateColumns = gridTemplateColumns;
  customGrid.style.columnGap = columnGap;
  customGrid.style.rowGap = '28px'; // オリジナルの margin-bottom 28px を行間として再現
  customGrid.style.marginBottom = '28px';
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

async function filterByActress(aliasId) {
  if (aliasId !== undefined) {
    currentSelectedAliasId = aliasId;
  }

  if (!localData) return;

  const originalSection = document.querySelector('section');
  if (!originalSection) return;

  const originalVirtualContainer = originalSection.firstElementChild;
  let customGrid = document.getElementById('custom-filter-grid');

  // 【指定なし（リセット）】カスタムグリッドを隠し、元の表示・レスポンシブ構造を復元
  if (currentSelectedAliasId === "") {
    if (customGrid) customGrid.style.display = 'none';
    if (originalVirtualContainer) originalVirtualContainer.style.display = '';
    return;
  }

  // 未読み込みカードがある場合は自動スキャン実行
  if (cardCache.size < Object.keys(localData.packages).length) {
    await scanAndCacheAllCards();
  } else {
    cacheArticlesFromDOM();
  }

  // 元の仮想スクロール表示領域を非表示化
  if (originalVirtualContainer) {
    originalVirtualContainer.style.display = 'none';
  }

  // カスタムグリッド要素の作成
  if (!customGrid) {
    customGrid = document.createElement('div');
    customGrid.id = 'custom-filter-grid';
    originalSection.appendChild(customGrid);

    // ウィンドウサイズ変更時にオリジナルのグリッドスタイルを自動同期
    window.addEventListener('resize', syncGridStyle);

    // オリジナル要素のスタイル変更（レスポンシブ変化）を検知して同期
    const originalGrid = document.querySelector('section article')?.parentElement;
    if (originalGrid && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => syncGridStyle());
      resizeObserver.observe(originalGrid);
    }
  }

  // オリジナルのレスポンシブスタイルを適用
  syncGridStyle();

  // 絞り込み結果を描画
  renderCustomGrid();
}

// 選択中の条件に合わせてカスタムグリッドを描画する関数
function renderCustomGrid() {
  const customGrid = document.getElementById('custom-filter-grid');
  if (!customGrid || currentSelectedAliasId === "") return;

  customGrid.innerHTML = '';
  customGrid.style.display = 'grid';

  // 一致するパッケージPIDを取得
  const targetPids = Object.entries(localData.packages)
    .filter(([_, info]) => info.aliases && info.aliases.includes(currentSelectedAliasId))
    .map(([pid, _]) => pid);

  // キャッシュから対象カードをそのまま流用して左上詰めで追加
  targetPids.forEach(pid => {
    const cachedArticle = cardCache.get(pid);
    if (cachedArticle) {
      const articleClone = cachedArticle.cloneNode(true);
      articleClone.style.display = 'flex';
      customGrid.appendChild(articleClone);
    }
  });
}

// 画面内のDOM変化を監視して動的にキャッシュ追加・グリッド更新
function observeDOMChanges() {
  cacheArticlesFromDOM(); // 初回実行

  const targetNode = document.querySelector('section') || document.body;
  const observer = new MutationObserver(() => {
    const previousCacheSize = cardCache.size;
    cacheArticlesFromDOM();

    // 手動スクロール等で新しいカードがキャッシュされた場合、絞り込み画面を更新
    if (cardCache.size > previousCacheSize && currentSelectedAliasId !== "") {
      renderCustomGrid();
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
  observeDOMChanges(); // DOM監視とリアルタイムキャッシュを開始

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