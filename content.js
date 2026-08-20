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
  if (articles.length === 0) return;

  // 全てのグリッド要素と、その親の行ラッパー要素を取得
  const allGrids = Array.from(document.querySelectorAll('.grid'));
  const rowWrappers = allGrids.map(grid => grid.parentElement);

  // 1. 各articleの元の親コンテナを記憶し、絞り込み条件に合うか判定
  const matchedArticles = [];
  articles.forEach(article => {
    // 初回参照時に元の親グリッドを記憶
    if (!article._originalParent) {
      article._originalParent = article.parentElement;
    }

    const link = article.querySelector('a[data-testid="PackageCard"]');
    if (!link) return;

    const pidMatch = link.getAttribute('href').match(/pid=([^&]+)/);
    if (!pidMatch) return;

    const pid = pidMatch[1];
    const packageInfo = localData.packages[pid];
    const aliases = packageInfo ? packageInfo.aliases : [];

    // 選択された条件に合致するか判定
    if (currentSelectedAliasId === "" || aliases.includes(currentSelectedAliasId)) {
      matchedArticles.push(article);
    }
  });

  if (currentSelectedAliasId === "") {
    // 【指定なしの場合】すべてのカードを元の親グリッドに戻し、表示状態をリセット
    articles.forEach(article => {
      if (article._originalParent) {
        article._originalParent.appendChild(article);
      }
      article.style.display = '';
    });
    // 全ての行ラッパーを表示
    rowWrappers.forEach(wrapper => {
      if (wrapper) wrapper.style.display = '';
    });
    // メイングリッドの行間スタイルをリセット
    if (allGrids[0]) allGrids[0].style.rowGap = '';
  } else {
    // 【絞り込みありの場合】カードを左上から順に詰めて並べる
    if (allGrids.length === 0) return;
    const mainGrid = allGrids[0];

    // 1つのグリッド内で複数行並ぶため行間（row-gap）を設定
    mainGrid.style.rowGap = '28px';

    // 該当するカードを表示し、先頭のグリッドに順番に追加（自動で左上から詰まる）
    matchedArticles.forEach(article => {
      article.style.display = '';
      mainGrid.appendChild(article);
    });

    // 該当しないカードは非表示
    articles.forEach(article => {
      if (!matchedArticles.includes(article)) {
        article.style.display = 'none';
      }
    });

    // 2行目以降の空になった行ラッパーを非表示にし、先頭行ラッパーのみ表示
    rowWrappers.forEach((wrapper, index) => {
      if (wrapper) {
        wrapper.style.display = (index === 0) ? '' : 'none';
      }
    });
  }
}

// スクロール等による動的DOM追加を監視し、選択中の条件で再絞り込みを行う関数
function observeDOMChanges() {
  const targetNode = document.querySelector('section') || document.body;
  const observer = new MutationObserver((mutations) => {
    let hasUnprocessedArticles = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          // 新しく追加されたノードからarticle要素を検出
          const articles = node.tagName === 'ARTICLE' ? [node] : Array.from(node.querySelectorAll?.('article') || []);
          for (const article of articles) {
            // 元の親が未記録の（新しく動的読み込みされた）カードがあるか判定
            if (!article._originalParent) {
              hasUnprocessedArticles = true;
              break;
            }
          }
        }
        if (hasUnprocessedArticles) break;
      }
      if (hasUnprocessedArticles) break;
    }

    // 未処理の新しいカードが追加された場合のみ絞り込みを再適用
    if (hasUnprocessedArticles && currentSelectedAliasId !== "") {
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