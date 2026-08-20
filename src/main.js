import './style.css';
import './transfer.js';

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
 * スタンプ進捗保存API
 */
const PROGRESS_API_URL =
  `${ADMIN_BASE_URL}/api/save-progress.php`;

/**
 * スタンプ進捗取得API
 */
const GET_PROGRESS_API_URL =
  `${ADMIN_BASE_URL}/api/get-progress.php`;

/**
 * 参加者IDを保存するLocalStorageキー
 */
const PARTICIPANT_KEY_STORAGE_KEY =
  'ar-stamp-participant-key';

/**
 * AR認識データ
 */
const TARGETS_MIND_URL =
  `${ADMIN_BASE_URL}/targets/targets.mind?v=${Date.now()}`;

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

/**
 * このブラウザの参加者ID
 */
let participantKey = '';

/* ===========================
   参加者ID
=========================== */

/**
 * UUID形式の参加者IDを生成する
 */
const createParticipantKey = () => {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === 'function'
  ) {
    return window.crypto.randomUUID();
  }

  return (
    'participant-' +
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2)
  );
};

/**
 * LocalStorageから参加者IDを取得する。
 * 未発行なら新規発行して保存する。
 */
const getOrCreateParticipantKey = () => {
  try {
    const savedParticipantKey =
      localStorage.getItem(
        PARTICIPANT_KEY_STORAGE_KEY
      );

    if (savedParticipantKey) {
      return savedParticipantKey;
    }

    const newParticipantKey =
      createParticipantKey();

    localStorage.setItem(
      PARTICIPANT_KEY_STORAGE_KEY,
      newParticipantKey
    );

    return newParticipantKey;
  } catch (error) {
    console.warn(
      '参加者IDをLocalStorageへ保存できませんでした。',
      error
    );

    return createParticipantKey();
  }
};

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

/**
 * スタンプ進捗をサーバーへ保存する
 */
const saveProgressToServer =
  async (posterId) => {
    if (
      !participantKey ||
      !Number.isInteger(
        Number(posterId)
      ) ||
      Number(posterId) <= 0
    ) {
      console.warn(
        '進捗保存に必要な情報が不足しています。',
        {
          participantKey,
          posterId,
        }
      );

      return false;
    }

    const response =
      await fetch(
        PROGRESS_API_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            participantKey,

            posterId:
              Number(posterId),
          }),
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ??
        `進捗保存に失敗しました: ${response.status}`
      );
    }

    console.log(
      'スタンプ進捗をDBへ保存しました。',
      {
        participantKey,

        posterId:
          Number(posterId),

        saved:
          data.saved,
      }
    );

    return true;
  };

/**
 * DBから参加者のスタンプ進捗を取得する
 */
const fetchProgressFromServer =
  async () => {
    if (!participantKey) {
      console.warn(
        '進捗取得に必要な参加者IDがありません。'
      );

      return [];
    }

    const progressUrl =
      new URL(
        GET_PROGRESS_API_URL
      );

    progressUrl.searchParams.set(
      'participantKey',
      participantKey
    );

    const response =
      await fetch(
        progressUrl.toString(),
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ??
        `進捗取得に失敗しました: ${response.status}`
      );
    }

    if (
      !Array.isArray(
        data.posterIds
      )
    ) {
      throw new Error(
        '進捗取得APIのposterIdsが正しい形式ではありません。'
      );
    }

    return data.posterIds.map(
      (posterId) =>
        Number(posterId)
    );
  };

/**
 * DBから取得した進捗を
 * LocalStorageへ復元する
 *
 * LocalStorage側にしかない進捗は消さず、
 * DB側の進捗を追加する形で統合する。
 */
const restoreServerProgressToLocal =
  async () => {
    try {
      const posterIds =
        await fetchProgressFromServer();

      if (posterIds.length === 0) {
        console.log(
          'DB側に保存済みのスタンプ進捗はありません。'
        );

        return true;
      }

      const quizzes =
        Object.values(
          quizData
        );

      posterIds.forEach(
        (posterId) => {
          const quiz =
            quizzes.find(
              (item) => {
                return (
                  Number(
                    item?.spotId
                  ) ===
                  Number(
                    posterId
                  )
                );
              }
            );

          if (
            !quiz ||
            !quiz.stampId
          ) {
            console.warn(
              `DB進捗に対応するスタンプが見つかりません: posterId=${posterId}`
            );

            return;
          }

          localStorage.setItem(
            quiz.stampId,
            'completed'
          );
        }
      );

      updateStampBook();

      console.log(
        'DBのスタンプ進捗を端末へ復元しました。',
        posterIds
      );

      return true;
    } catch (error) {
      /*
       * DBからの取得に失敗しても
       * LocalStorageの進捗で利用を継続する
       */
      console.warn(
        'DBからのスタンプ進捗取得に失敗しました。LocalStorageの進捗を使用します。',
        error
      );

      return false;
    }
  };

/**
 * LocalStorageに残っている既存スタンプを
 * DBへ同期する
 */
const syncLocalProgressToServer =
  async () => {
    const quizzes =
      Object.values(
        quizData
      );

    for (const quiz of quizzes) {
      if (
        !quiz ||
        !quiz.stampId ||
        !quiz.spotId
      ) {
        continue;
      }

      if (
        !isStampCompleted(
          quiz.stampId
        )
      ) {
        continue;
      }

      try {
        await saveProgressToServer(
          quiz.spotId
        );
      } catch (error) {
        console.warn(
          `既存スタンプのDB同期に失敗しました: ${quiz.stampId}`,
          error
        );
      }
    }
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

  return normalizedPath;
};

/* ===========================
   2Dキャラクター
=========================== */

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

    assets.setAttribute(
      'timeout',
      '10000'
    );

    arScene.insertBefore(
      assets,
      arScene.firstChild
    );

    return assets;
  };

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

    image.crossOrigin =
      'anonymous';

    image.setAttribute(
      'crossorigin',
      'anonymous'
    );

    image.addEventListener(
      'load',
      () => {
        console.log(
          `2Dキャラクター画像を読み込みました: ${assetId}`,
          imageUrl
        );
      }
    );

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

  const characterImageUrl =
    getCharacterImageUrl(
      spot
    );

  const characterAssetSelector =
    registerCharacterAsset(
      spot
    );

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

  const character =
    document.createElement(
      'a-image'
    );

  character.id =
    `character-image-${quizNumber}`;

  character.classList.add(
    'character-image'
  );

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
    '0.5'
  );

  character.setAttribute(
    'height',
    '0.7'
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

const resetQuizResult = () => {
  quizResult.textContent =
    '';

  quizResult.className =
    'quiz-result';
};

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

const saveStamp = (
  stampId,
  posterId
) => {
  localStorage.setItem(
    stampId,
    'completed'
  );

  updateStampBook();

  saveProgressToServer(
    posterId
  ).catch(
    (error) => {
      console.error(
        'スタンプ進捗のDB保存に失敗しました。',
        error
      );
    }
  );
};

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

const playStampAnimation = (
  stampId,
  posterId
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
        stampId,
        posterId
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

const showStampAcquisition = (
  stampId,
  posterId
) => {
  window.setTimeout(
    () => {
      closeQuiz();

      openStampBook();

      window.setTimeout(
        () => {
          playStampAnimation(
            stampId,
            posterId
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

      saveProgressToServer(
        quiz.spotId
      ).catch(
        (error) => {
          console.warn(
            '獲得済みスタンプのDB同期に失敗しました。',
            error
          );
        }
      );

      return;
    }

    quizResult.textContent =
      '正解！スタンプを獲得しました！';

    quizResult.className =
      'quiz-result is-correct';

    showStampAcquisition(
      quiz.stampId,
      quiz.spotId
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

    createQuizDataFromSpots(
      sortedSpots
    );

    registerCharacterAssets(
      sortedSpots
    );

    createArTargets(
      sortedSpots
    );

    createStampBook(
      sortedSpots
    );

    /*
     * LocalStorageの進捗をまず表示
     */
    updateStampBook();

    /*
     * DBの進捗を取得
     * ↓
     * LocalStorageに復元
     * ↓
     * スタンプ帳へ反映
     */
    await restoreServerProgressToLocal();

    /*
     * LocalStorageにしか存在しない進捗は
     * DB側へ送信
     */
    await syncLocalProgressToServer();

    /*
     * 最終状態
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
    participantKey =
      getOrCreateParticipantKey();

    console.log(
      '参加者ID:',
      participantKey
    );

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

    updateFollowingCharacterImage(
      DEFAULT_CHARACTER_IMAGE
    );

    showScanGuide();

    hideFollowingCharacter();

    configureMindAr();

    await loadApiData();

    console.log(
      'DB進捗保存・復元対応のMindARスタンプラリーを起動しました。'
    );
  };

initializeApp();

/* ===========================
   デバッグ用
=========================== */

/*
 * 注意：
 *
 * localStorage.clear();
 *
 * を実行すると、
 * スタンプだけでなく participantKey も消えます。
 *
 * つまり次回アクセス時に
 * 「別の参加者」として新しいIDが作られます。
 *
 * participantKeyを残したまま
 * スタンプだけ消したい場合は、
 * stamp-spot- で始まるLocalStorageキーだけを
 * 削除してください。
 */