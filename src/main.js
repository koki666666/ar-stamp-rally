import './style.css';

/* ===========================
   環境設定
=========================== */

/**
 * localhost / ローカルIPなら
 * ローカルの管理画面を使用する
 */
const isLocal =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname.startsWith('192.168.');

/**
 * 管理画面のURL
 */
const ADMIN_BASE_URL = isLocal
  ? 'http://localhost/ar-stamp-admin'
  : 'https://m-shokai.jp/ar-stamp-admin';

/**
 * スポット情報API
 */
const API_URL =
  `${ADMIN_BASE_URL}/api/spots.php`;

/**
 * AR認識データ
 */
const TARGETS_MIND_URL =
  `${ADMIN_BASE_URL}/targets/targets.mind`;

/**
 * デフォルト2Dキャラクター画像
 */
const DEFAULT_CHARACTER_IMAGE =
  '/characters/ayu_main.png';

/**
 * 本番環境では
 * スマートフォン・タブレットのみ利用可能
 */
const isDevelopment =
  isLocal;

const isMobileOrTablet =
  /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent
  );

if (
  !isDevelopment &&
  !isMobileOrTablet
) {
  document.body.innerHTML = `
    <main class="device-restriction">
      <div class="device-restriction-card">
        <h1>
          スマートフォン・タブレット専用です
        </h1>

        <p>
          このARスタンプラリーは、
          スマートフォンまたはタブレットから
          ご利用ください。
        </p>
      </div>
    </main>
  `;

  throw new Error(
    'PCからのアクセスを停止しました。'
  );
}

/* ===========================
   状態管理
=========================== */

/**
 * APIから取得したスポット一覧
 */
let spotData = [];

/**
 * クイズ情報
 */
const quizData = {};

/**
 * APIで取得した公開スポット数
 */
let totalStampCount = 0;

/**
 * 現在表示しているクイズ
 */
let currentQuizId = null;

/**
 * 回答済みか
 */
let quizAnswered = false;

/**
 * API読込完了フラグ
 */
let apiLoaded = false;

/**
 * 現在認識中・最後に認識した
 * 2Dキャラクター画像URL
 */
let currentCharacterImageUrl =
  DEFAULT_CHARACTER_IMAGE;

/* ===========================
   HTML要素
=========================== */

const arScene =
  document.querySelector(
    '#ar-scene'
  );

const arTargetContainer =
  document.querySelector(
    '#ar-target-container'
  );

const followingCharacter =
  document.querySelector(
    '#following-character'
  );

const scanGuide =
  document.querySelector(
    '#scan-guide'
  );

const quizModal =
  document.querySelector(
    '#quiz-modal'
  );

const quizQuestion =
  document.querySelector(
    '#quiz-question'
  );

const quizOptions =
  document.querySelector(
    '#quiz-options'
  );

const quizResult =
  document.querySelector(
    '#quiz-result'
  );

const quizCloseButton =
  document.querySelector(
    '#quiz-close-button'
  );

const stampBookButton =
  document.querySelector(
    '#stamp-book-button'
  );

const stampModal =
  document.querySelector(
    '#stamp-modal'
  );

const stampCloseButton =
  document.querySelector(
    '#stamp-close-button'
  );

const stampCount =
  document.querySelector(
    '#stamp-count'
  );

const stampModalCount =
  document.querySelector(
    '#stamp-modal-count'
  );

const stampList =
  document.querySelector(
    '#stamp-list'
  );

const completeMessage =
  document.querySelector(
    '#complete-message'
  );

/* ===========================
   MindAR認識データURL設定
=========================== */

const configureMindAr = () => {
  if (!arScene) {
    console.error(
      'ARシーンが見つかりません。'
    );

    return;
  }

  arScene.setAttribute(
    'mindar-image',
    `
      imageTargetSrc: ${TARGETS_MIND_URL};
      autoStart: true;
      maxTrack: 1;
    `
  );

  console.log(
    'MindAR認識データ:',
    TARGETS_MIND_URL
  );
};

/* ===========================
   API通信
=========================== */

/**
 * 管理画面APIから
 * 公開中のスポット情報を取得
 */
const fetchSpots =
  async () => {
    const response =
      await fetch(
        API_URL,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

    if (!response.ok) {
      throw new Error(
        `APIの取得に失敗しました: ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.message ??
        'スポット情報を取得できませんでした。'
      );
    }

    if (
      !Array.isArray(
        data.spots
      )
    ) {
      throw new Error(
        'APIのスポット情報が正しい形式ではありません。'
      );
    }

    return data.spots;
  };

/* ===========================
   データ整形
=========================== */

/**
 * 空文字やnullの選択肢を除外
 */
const normalizeOptions = (
  options
) => {
  if (
    !Array.isArray(
      options
    )
  ) {
    return [];
  }

  return options.filter(
    (option) => {
      return (
        typeof option === 'string' &&
        option.trim() !== ''
      );
    }
  );
};

/**
 * targetIndex順に並べる
 */
const sortSpotsByTargetIndex = (
  spots
) => {
  return [...spots].sort(
    (
      spotA,
      spotB
    ) => {
      return (
        Number(
          spotA.targetIndex
        ) -
        Number(
          spotB.targetIndex
        )
      );
    }
  );
};

/**
 * targetIndex確認
 *
 * 0,1,2,3...
 * と連続している必要がある
 */
const validateTargetIndexes = (
  spots
) => {
  spots.forEach(
    (
      spot,
      index
    ) => {
      const targetIndex =
        Number(
          spot.targetIndex
        );

      if (
        !Number.isInteger(
          targetIndex
        ) ||
        targetIndex < 0
      ) {
        throw new Error(
          `targetIndexが正しくありません: ${spot.title ?? '名称なし'}`
        );
      }

      if (
        targetIndex !==
        index
      ) {
        throw new Error(
          `targetIndexが連続していません。期待値: ${index} / 実際: ${targetIndex}`
        );
      }
    }
  );
};

/**
 * APIデータを
 * クイズ設定へ変換
 */
const createQuizDataFromSpots = (
  spots
) => {
  Object.keys(
    quizData
  ).forEach(
    (quizId) => {
      delete quizData[
        quizId
      ];
    }
  );

  spots.forEach(
    (spot) => {
      const targetIndex =
        Number(
          spot.targetIndex
        );

      const quizNumber =
        targetIndex + 1;

      const quizId =
        `quiz-${quizNumber}`;

      const stampId =
        `stamp-spot-${quizNumber}`;

      const options =
        normalizeOptions(
          spot.quiz?.options
        );

      quizData[
        quizId
      ] = {
        question:
          spot.quiz
            ?.question ??
          '問題が登録されていません。',

        options,

        correctAnswer:
          spot.quiz
            ?.correctAnswer ??
          '',

        stampId,

        spotId:
          Number(
            spot.id
          ),

        title:
          spot.title ??
          `スポット${quizNumber}`,

        targetIndex,

        characterImagePath:
          spot.characterImagePath ??
          '',

        stampName:
          spot.stamp?.name ??
          spot.title ??
          `スポット${quizNumber}`,

        stampImagePath:
          spot.stamp
            ?.imagePath ??
          '',
      };
    }
  );

  console.log(
    'クイズ設定を作成しました。',
    quizData
  );
};

/* ===========================
   画像URL変換
=========================== */

/**
 * DBの画像パスを
 * AR画面で使用できるURLへ変換
 */
const convertAssetUrl = (
  path
) => {
  if (
    typeof path !== 'string' ||
    path.trim() === ''
  ) {
    return '';
  }

  const normalizedPath =
    path.trim();

  /*
   * 完全URL
   */
  if (
    normalizedPath.startsWith(
      'http://'
    ) ||
    normalizedPath.startsWith(
      'https://'
    )
  ) {
    return normalizedPath;
  }

  /*
   * ./uploads/image.png
   */
  if (
    normalizedPath.startsWith(
      './uploads/'
    )
  ) {
    return (
      `${ADMIN_BASE_URL}/` +
      normalizedPath.replace(
        './',
        ''
      )
    );
  }

  /*
   * /uploads/image.png
   */
  if (
    normalizedPath.startsWith(
      '/uploads/'
    )
  ) {
    return (
      ADMIN_BASE_URL +
      normalizedPath
    );
  }

  /*
   * uploads/image.png
   */
  if (
    normalizedPath.startsWith(
      'uploads/'
    )
  ) {
    return (
      `${ADMIN_BASE_URL}/` +
      normalizedPath
    );
  }

  /*
   * ./targets/
   */
  if (
    normalizedPath.startsWith(
      './targets/'
    )
  ) {
    return (
      `${ADMIN_BASE_URL}/` +
      normalizedPath.replace(
        './',
        ''
      )
    );
  }

  /*
   * /targets/
   */
  if (
    normalizedPath.startsWith(
      '/targets/'
    )
  ) {
    return (
      ADMIN_BASE_URL +
      normalizedPath
    );
  }

  /*
   * targets/
   */
  if (
    normalizedPath.startsWith(
      'targets/'
    )
  ) {
    return (
      `${ADMIN_BASE_URL}/` +
      normalizedPath
    );
  }

  /*
   * /images/
   * /characters/
   * などはAR本体
   */
  return normalizedPath;
};

/* ===========================
   2Dキャラクター
=========================== */

/**
 * スポットの
 * 2DキャラクターURL取得
 */
const getCharacterImageUrl = (
  spot
) => {
  const convertedUrl =
    convertAssetUrl(
      spot.characterImagePath
    );

  if (convertedUrl) {
    return convertedUrl;
  }

  return DEFAULT_CHARACTER_IMAGE;
};

/**
 * <a-assets>を取得
 *
 * HTML側になければ
 * JavaScriptで自動作成
 */
const getOrCreateAssetsContainer =
  () => {
    if (!arScene) {
      return null;
    }

    let assets =
      arScene.querySelector(
        'a-assets'
      );

    if (assets) {
      return assets;
    }

    assets =
      document.createElement(
        'a-assets'
      );

    /*
     * 読み込みで
     * シーン全体が長時間停止しないようにする
     */
    assets.setAttribute(
      'timeout',
      '10000'
    );

    /*
     * シーンの先頭へ追加
     */
    arScene.insertBefore(
      assets,
      arScene.firstChild
    );

    return assets;
  };

/**
 * キャラクター画像を
 * A-Frameのa-assetsへ登録
 *
 * 戻り値：
 * #character-asset-1
 * のようなセレクタ
 */
const registerCharacterAsset =
  (
    spot
  ) => {
    const targetIndex =
      Number(
        spot.targetIndex
      );

    const quizNumber =
      targetIndex + 1;

    const assetId =
      `character-asset-${quizNumber}`;

    /*
     * 既に登録済みなら
     * そのまま使う
     */
    const existingAsset =
      document.getElementById(
        assetId
      );

    if (existingAsset) {
      return `#${assetId}`;
    }

    const assets =
      getOrCreateAssetsContainer();

    if (!assets) {
      console.error(
        'a-assetsを作成できませんでした。'
      );

      return '';
    }

    const imageUrl =
      getCharacterImageUrl(
        spot
      );

    const image =
      document.createElement(
        'img'
      );

    image.id =
      assetId;

    /*
     * WebGLテクスチャとして
     * クロスオリジン画像を使うため
     */
    image.crossOrigin =
      'anonymous';

    image.setAttribute(
      'crossorigin',
      'anonymous'
    );

    /*
     * 読み込み完了ログ
     */
    image.addEventListener(
      'load',
      () => {
        console.log(
          `2Dキャラクター画像を読み込みました: ${assetId}`,
          imageUrl
        );
      }
    );

    /*
     * 読み込み失敗ログ
     */
    image.addEventListener(
      'error',
      () => {
        console.error(
          `2Dキャラクター画像の読み込みに失敗しました: ${assetId}`,
          imageUrl
        );
      }
    );

    image.src =
      imageUrl;

    assets.appendChild(
      image
    );

    return `#${assetId}`;
  };

/**
 * 公開スポットすべての
 * キャラクターをa-assetsへ登録
 */
const registerCharacterAssets = (
  spots
) => {
  spots.forEach(
    (spot) => {
      registerCharacterAsset(
        spot
      );
    }
  );

  console.log(
    `${spots.length}件の2Dキャラクターアセットを登録しました。`
  );
};

/**
 * 追従キャラクターの
 * 画像変更
 *
 * こちらは普通のHTML imgなので
 * URLを直接指定してOK
 */
const updateFollowingCharacterImage = (
  imageUrl
) => {
  if (
    !followingCharacter
  ) {
    return;
  }

  const image =
    followingCharacter.querySelector(
      'img'
    );

  if (!image) {
    return;
  }

  image.src =
    imageUrl ||
    DEFAULT_CHARACTER_IMAGE;
};

/* ===========================
   ARターゲット自動生成
=========================== */

/**
 * ARターゲットを1件作成
 */
const createArTarget = (
  spot
) => {
  const targetIndex =
    Number(
      spot.targetIndex
    );

  const quizNumber =
    targetIndex + 1;

  const quizId =
    `quiz-${quizNumber}`;

  /**
   * 普通のHTML用URL
   *
   * ポスターから離れた後の
   * 追従キャラクターに使用
   */
  const characterImageUrl =
    getCharacterImageUrl(
      spot
    );

  /**
   * A-Frame用
   *
   * #character-asset-1
   * のようなID参照
   */
  const characterAssetSelector =
    registerCharacterAsset(
      spot
    );

  /*
   * ARターゲット
   */
  const target =
    document.createElement(
      'a-entity'
    );

  target.id =
    `ar-target-${quizNumber}`;

  target.classList.add(
    'ar-target'
  );

  target.dataset.quizId =
    quizId;

  target.setAttribute(
    'mindar-image-target',
    `targetIndex: ${targetIndex}`
  );

  /*
   * 位置確認用
   */
  const plane =
    document.createElement(
      'a-plane'
    );

  plane.setAttribute(
    'color',
    '#4b73ff'
  );

  plane.setAttribute(
    'opacity',
    '0.08'
  );

  plane.setAttribute(
    'position',
    '0 0 0'
  );

  plane.setAttribute(
    'width',
    '1'
  );

  plane.setAttribute(
    'height',
    '0.552'
  );

  /*
   * スポットごとの
   * 2Dキャラクター
   */
  const character =
    document.createElement(
      'a-image'
    );

  character.id =
    `character-image-${quizNumber}`;

  character.classList.add(
    'character-image'
  );

  /*
   * ★重要
   *
   * URLを直接指定せず、
   * a-assetsに登録した画像を参照する
   */
  if (characterAssetSelector) {
    character.setAttribute(
      'src',
      characterAssetSelector
    );
  }

  character.setAttribute(
    'position',
    '0 0.17 0.15'
  );

  character.setAttribute(
    'width',
    '0.38'
  );

  character.setAttribute(
    'height',
    '0.48'
  );

  character.setAttribute(
    'transparent',
    'true'
  );

  character.setAttribute(
    'material',
    `
      alphaTest: 0.01;
      transparent: true;
      side: double;
    `
  );

  target.appendChild(
    plane
  );

  target.appendChild(
    character
  );

  /*
   * 認識したとき
   */
  target.addEventListener(
    'targetFound',
    () => {
      console.log(
        `認識画像を発見しました: ${quizId}`
      );

      currentCharacterImageUrl =
        characterImageUrl;

      updateFollowingCharacterImage(
        currentCharacterImageUrl
      );

      hideFollowingCharacter();

      hideScanGuide();

      openQuiz(
        quizId
      );
    }
  );

  /*
   * 見失ったとき
   */
  target.addEventListener(
    'targetLost',
    () => {
      console.log(
        `認識画像を見失いました: ${quizId}`
      );

      updateFollowingCharacterImage(
        characterImageUrl
      );

      showFollowingCharacter();

      if (
        !quizModal.classList.contains(
          'is-visible'
        ) &&
        !stampModal.classList.contains(
          'is-visible'
        )
      ) {
        showScanGuide();
      }
    }
  );

  return target;
};

/**
 * APIのスポット数だけ
 * ARターゲット生成
 */
const createArTargets = (
  spots
) => {
  if (!arTargetContainer) {
    throw new Error(
      'ARターゲット生成領域が見つかりません。'
    );
  }

  arTargetContainer.innerHTML =
    '';

  spots.forEach(
    (spot) => {
      const target =
        createArTarget(
          spot
        );

      arTargetContainer.appendChild(
        target
      );
    }
  );

  console.log(
    `${spots.length}件のARターゲットを生成しました。`
  );
};

/* ===========================
   スタンプ台紙自動生成
=========================== */

/**
 * スタンプを1件生成
 */
const createStampItem = (
  quiz,
  index
) => {
  const stampItem =
    document.createElement(
      'div'
    );

  stampItem.className =
    'stamp-item';

  stampItem.dataset.stampId =
    quiz.stampId;

  /*
   * スタンプ画像
   */
  const stampMark =
    document.createElement(
      'div'
    );

  stampMark.className =
    'stamp-mark';

  const stampImage =
    document.createElement(
      'img'
    );

  stampImage.className =
    'stamp-image';

  stampImage.alt =
    `${quiz.stampName}のスタンプ`;

  if (
    quiz.stampImagePath
  ) {
    stampImage.src =
      convertAssetUrl(
        quiz.stampImagePath
      );
  } else {
    stampImage.src =
      '/images/仮画像.png';
  }

  const placeholder =
    document.createElement(
      'span'
    );

  placeholder.className =
    'stamp-placeholder';

  placeholder.textContent =
    '？';

  stampMark.appendChild(
    stampImage
  );

  stampMark.appendChild(
    placeholder
  );

  /*
   * スタンプ情報
   */
  const information =
    document.createElement(
      'div'
    );

  information.className =
    'stamp-information';

  const number =
    document.createElement(
      'p'
    );

  number.className =
    'stamp-number';

  number.textContent =
    `SPOT ${index + 1}`;

  const title =
    document.createElement(
      'h3'
    );

  title.textContent =
    quiz.stampName;

  const status =
    document.createElement(
      'p'
    );

  status.className =
    'stamp-status';

  status.textContent =
    '未獲得';

  information.appendChild(
    number
  );

  information.appendChild(
    title
  );

  information.appendChild(
    status
  );

  stampItem.appendChild(
    stampMark
  );

  stampItem.appendChild(
    information
  );

  return stampItem;
};

/**
 * APIのスポット数だけ
 * スタンプ欄を生成
 */
const createStampBook = (
  spots
) => {
  if (!stampList) {
    throw new Error(
      'スタンプ台紙の領域が見つかりません。'
    );
  }

  stampList.innerHTML =
    '';

  totalStampCount =
    spots.length;

  spots.forEach(
    (
      spot,
      index
    ) => {
      const quizNumber =
        Number(
          spot.targetIndex
        ) + 1;

      const quizId =
        `quiz-${quizNumber}`;

      const quiz =
        quizData[
          quizId
        ];

      if (!quiz) {
        console.warn(
          `スタンプ生成用クイズが見つかりません: ${quizId}`
        );

        return;
      }

      const stampItem =
        createStampItem(
          quiz,
          index
        );

      stampList.appendChild(
        stampItem
      );
    }
  );

  stampCount.textContent =
    `0 / ${totalStampCount}`;

  stampModalCount.textContent =
    `0 / ${totalStampCount}`;

  console.log(
    `${totalStampCount}件のスタンプ欄を生成しました。`
  );
};

/* ===========================
   追従キャラクター
=========================== */

const showFollowingCharacter =
  () => {
    if (
      !followingCharacter
    ) {
      return;
    }

    updateFollowingCharacterImage(
      currentCharacterImageUrl
    );

    followingCharacter.classList.add(
      'is-visible'
    );

    followingCharacter.setAttribute(
      'aria-hidden',
      'false'
    );
  };

const hideFollowingCharacter =
  () => {
    if (
      !followingCharacter
    ) {
      return;
    }

    followingCharacter.classList.remove(
      'is-visible'
    );

    followingCharacter.setAttribute(
      'aria-hidden',
      'true'
    );
  };

/* ===========================
   画像認識ガイド
=========================== */

const showScanGuide =
  () => {
    if (!scanGuide) {
      return;
    }

    scanGuide.classList.remove(
      'is-hidden'
    );

    scanGuide.setAttribute(
      'aria-hidden',
      'false'
    );
  };

const hideScanGuide =
  () => {
    if (!scanGuide) {
      return;
    }

    scanGuide.classList.add(
      'is-hidden'
    );

    scanGuide.setAttribute(
      'aria-hidden',
      'true'
    );
  };
  /* ===========================
   クイズ
=========================== */

/**
 * 現在のクイズ設定を取得
 */
const getCurrentQuiz = () => {
  if (!currentQuizId) {
    return null;
  }

  return (
    quizData[
      currentQuizId
    ] ?? null
  );
};

/**
 * クイズ結果表示を初期化
 */
const resetQuizResult = () => {
  quizResult.textContent =
    '';

  quizResult.className =
    'quiz-result';
};

/**
 * 選択肢を生成
 */
const createQuizOptions = (
  quiz
) => {
  quizOptions.innerHTML =
    '';

  if (
    quiz.options.length === 0
  ) {
    quizResult.textContent =
      '選択肢が登録されていません。';

    quizResult.className =
      'quiz-result is-incorrect';

    return;
  }

  quiz.options.forEach(
    (answer) => {
      const optionButton =
        document.createElement(
          'button'
        );

      optionButton.className =
        'quiz-option';

      optionButton.type =
        'button';

      optionButton.dataset.answer =
        answer;

      optionButton.textContent =
        answer;

      optionButton.addEventListener(
        'click',
        () => {
          checkAnswer(
            answer
          );
        }
      );

      quizOptions.appendChild(
        optionButton
      );
    }
  );
};

/**
 * クイズを開く
 */
const openQuiz = (
  quizId
) => {
  hideScanGuide();

  if (!apiLoaded) {
    currentQuizId =
      null;

    quizQuestion.textContent =
      '問題情報を読み込んでいます。';

    quizOptions.innerHTML =
      '';

    quizResult.textContent =
      '少し待ってから、もう一度ポスターを映してください。';

    quizResult.className =
      'quiz-result is-incorrect';

    quizModal.classList.add(
      'is-visible'
    );

    quizModal.setAttribute(
      'aria-hidden',
      'false'
    );

    return;
  }

  const quiz =
    quizData[
      quizId
    ];

  if (!quiz) {
    currentQuizId =
      null;

    quizQuestion.textContent =
      'このポスターに対応する問題がありません。';

    quizOptions.innerHTML =
      '';

    quizResult.textContent =
      '管理画面の設定を確認してください。';

    quizResult.className =
      'quiz-result is-incorrect';

    quizModal.classList.add(
      'is-visible'
    );

    quizModal.setAttribute(
      'aria-hidden',
      'false'
    );

    console.error(
      `クイズ設定が見つかりません: ${quizId}`
    );

    return;
  }

  if (
    quizModal.classList.contains(
      'is-visible'
    ) &&
    currentQuizId ===
      quizId
  ) {
    return;
  }

  currentQuizId =
    quizId;

  quizAnswered =
    false;

  quizQuestion.textContent =
    quiz.question;

  resetQuizResult();

  createQuizOptions(
    quiz
  );

  quizModal.classList.add(
    'is-visible'
  );

  quizModal.setAttribute(
    'aria-hidden',
    'false'
  );

  console.log(
    `クイズを表示しました: ${quizId}`,
    quiz
  );
};

/**
 * クイズを閉じる
 */
const closeQuiz = () => {
  quizModal.classList.remove(
    'is-visible'
  );

  quizModal.setAttribute(
    'aria-hidden',
    'true'
  );

  showScanGuide();
};

/**
 * 選択肢を押せなくする
 */
const disableOptions = () => {
  const optionButtons =
    quizOptions.querySelectorAll(
      '.quiz-option'
    );

  optionButtons.forEach(
    (option) => {
      option.disabled =
        true;
    }
  );
};

/* ===========================
   スタンプ台紙
=========================== */

/**
 * スタンプ台紙を開く
 */
const openStampBook = () => {
  updateStampBook();

  hideScanGuide();

  stampModal.classList.add(
    'is-visible'
  );

  stampModal.setAttribute(
    'aria-hidden',
    'false'
  );
};

/**
 * スタンプ台紙を閉じる
 */
const closeStampBook = () => {
  stampModal.classList.remove(
    'is-visible'
  );

  stampModal.setAttribute(
    'aria-hidden',
    'true'
  );

  showScanGuide();
};

/**
 * スタンプを保存
 */
const saveStamp = (
  stampId
) => {
  localStorage.setItem(
    stampId,
    'completed'
  );

  updateStampBook();
};

/**
 * 獲得済みか確認
 */
const isStampCompleted = (
  stampId
) => {
  return (
    localStorage.getItem(
      stampId
    ) ===
    'completed'
  );
};

/**
 * スタンプ台紙を更新
 */
const updateStampBook = () => {
  let completedStampCount =
    0;

  const stampItems =
    document.querySelectorAll(
      '.stamp-item'
    );

  stampItems.forEach(
    (stampItem) => {
      const stampId =
        stampItem.dataset
          .stampId;

      const stampStatus =
        stampItem.querySelector(
          '.stamp-status'
        );

      const completed =
        isStampCompleted(
          stampId
        );

      if (completed) {
        completedStampCount +=
          1;

        stampItem.classList.add(
          'completed'
        );

        if (
          stampStatus
        ) {
          stampStatus.textContent =
            '獲得済み';
        }
      } else {
        stampItem.classList.remove(
          'completed'
        );

        if (
          stampStatus
        ) {
          stampStatus.textContent =
            '未獲得';
        }
      }
    }
  );

  if (stampCount) {
    stampCount.textContent =
      `${completedStampCount} / ${totalStampCount}`;
  }

  if (
    stampModalCount
  ) {
    stampModalCount.textContent =
      `${completedStampCount} / ${totalStampCount}`;
  }

  if (
    totalStampCount > 0 &&
    completedStampCount ===
      totalStampCount
  ) {
    completeMessage.classList.add(
      'show'
    );
  } else {
    completeMessage.classList.remove(
      'show'
    );
  }
};

/* ===========================
   スタンプ押印
=========================== */

/**
 * 押印アニメーション
 */
const playStampAnimation = (
  stampId
) => {
  const stampItem =
    document.querySelector(
      `[data-stamp-id="${stampId}"]`
    );

  if (!stampItem) {
    console.error(
      `スタンプ要素が見つかりません: ${stampId}`
    );

    return;
  }

  stampItem.classList.remove(
    'is-stamping'
  );

  void stampItem.offsetWidth;

  stampItem.classList.add(
    'is-stamping'
  );

  window.setTimeout(
    () => {
      saveStamp(
        stampId
      );
    },
    650
  );

  window.setTimeout(
    () => {
      stampItem.classList.remove(
        'is-stamping'
      );
    },
    950
  );
};

/**
 * 正解後のスタンプ獲得表示
 */
const showStampAcquisition = (
  stampId
) => {
  window.setTimeout(
    () => {
      closeQuiz();

      openStampBook();

      window.setTimeout(
        () => {
          playStampAnimation(
            stampId
          );
        },
        400
      );
    },
    900
  );
};

/* ===========================
   回答判定
=========================== */

/**
 * 回答を判定
 */
const checkAnswer = (
  selectedAnswer
) => {
  if (quizAnswered) {
    return;
  }

  const quiz =
    getCurrentQuiz();

  if (!quiz) {
    console.error(
      '現在のクイズ設定を取得できません。'
    );

    return;
  }

  quizAnswered =
    true;

  disableOptions();

  if (
    selectedAnswer ===
    quiz.correctAnswer
  ) {
    if (
      isStampCompleted(
        quiz.stampId
      )
    ) {
      quizResult.textContent =
        '正解！このスタンプは獲得済みです。';

      quizResult.className =
        'quiz-result is-correct';

      return;
    }

    quizResult.textContent =
      '正解！スタンプを獲得しました！';

    quizResult.className =
      'quiz-result is-correct';

    showStampAcquisition(
      quiz.stampId
    );

    return;
  }

  quizResult.textContent =
    `不正解です。正解は${quiz.correctAnswer}です。`;

  quizResult.className =
    'quiz-result is-incorrect';
};

/* ===========================
   APIデータ読み込み
=========================== */

/**
 * APIデータを取得して
 *
 * ・クイズ
 * ・キャラクターアセット
 * ・ARターゲット
 * ・スタンプ台紙
 *
 * を生成
 */
const loadApiData = async () => {
  apiLoaded =
    false;

  try {
    const spots =
      await fetchSpots();

    const sortedSpots =
      sortSpotsByTargetIndex(
        spots
      );

    validateTargetIndexes(
      sortedSpots
    );

    spotData =
      sortedSpots;

    totalStampCount =
      sortedSpots.length;

    /*
     * クイズ情報作成
     */
    createQuizDataFromSpots(
      sortedSpots
    );

    /*
     * まずキャラクター画像を
     * a-assetsへ登録
     */
    registerCharacterAssets(
      sortedSpots
    );

    /*
     * ARターゲット作成
     */
    createArTargets(
      sortedSpots
    );

    /*
     * スタンプ台紙作成
     */
    createStampBook(
      sortedSpots
    );

    /*
     * 保存済みスタンプ反映
     */
    updateStampBook();

    apiLoaded =
      true;

    console.log(
      '管理画面APIからスポット情報を読み込みました。',
      sortedSpots
    );

    console.log(
      `公開スポット数: ${totalStampCount}`
    );

    /*
     * キャラクター確認
     */
    sortedSpots.forEach(
      (spot) => {
        console.log(
          `キャラクター設定 targetIndex=${spot.targetIndex}:`,
          spot.characterImagePath ??
          'デフォルト画像'
        );
      }
    );
  } catch (
    error
  ) {
    apiLoaded =
      false;

    console.error(
      '管理画面APIとの接続に失敗しました。',
      error
    );

    if (
      stampCount
    ) {
      stampCount.textContent =
        '0 / 0';
    }

    if (
      stampModalCount
    ) {
      stampModalCount.textContent =
        '0 / 0';
    }
  }
};

/* ===========================
   ボタン操作
=========================== */

if (
  quizCloseButton
) {
  quizCloseButton.addEventListener(
    'click',
    () => {
      closeQuiz();
    }
  );
}

if (
  stampBookButton
) {
  stampBookButton.addEventListener(
    'click',
    () => {
      openStampBook();
    }
  );
}

if (
  stampCloseButton
) {
  stampCloseButton.addEventListener(
    'click',
    () => {
      closeStampBook();
    }
  );
}

if (
  stampModal
) {
  stampModal.addEventListener(
    'click',
    (event) => {
      if (
        event.target ===
        stampModal
      ) {
        closeStampBook();
      }
    }
  );
}

/**
 * Escapeキー
 */
document.addEventListener(
  'keydown',
  (event) => {
    if (
      event.key !==
      'Escape'
    ) {
      return;
    }

    if (
      stampModal &&
      stampModal.classList.contains(
        'is-visible'
      )
    ) {
      closeStampBook();

      return;
    }

    if (
      quizModal &&
      quizModal.classList.contains(
        'is-visible'
      )
    ) {
      closeQuiz();
    }
  }
);

/* ===========================
   初期処理
=========================== */

const initializeApp =
  async () => {
    totalStampCount =
      0;

    currentCharacterImageUrl =
      DEFAULT_CHARACTER_IMAGE;

    if (
      stampCount
    ) {
      stampCount.textContent =
        '0 / 0';
    }

    if (
      stampModalCount
    ) {
      stampModalCount.textContent =
        '0 / 0';
    }

    /*
     * 初期追従キャラ
     */
    updateFollowingCharacterImage(
      DEFAULT_CHARACTER_IMAGE
    );

    showScanGuide();

    hideFollowingCharacter();

    /*
     * MindAR設定
     */
    configureMindAr();

    /*
     * API取得・画面生成
     */
    await loadApiData();

    console.log(
      'A-Frameアセット対応・スポット別2Dキャラクター対応のMindARスタンプラリーを起動しました。'
    );
  };

initializeApp();

/* ===========================
   デバッグ用
=========================== */

/*
 * 全スタンプをリセットする場合
 *
 * Consoleで
 *
 * localStorage.clear();
 * location.reload();
 *
 * を実行
 */
