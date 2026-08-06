import './style.css';

/* ===========================
   環境設定
=========================== */

/**
 * 管理画面API
 *
 * PCのローカル確認用。
 * スマホやVercel本番環境から使う場合は、
 * 後から公開APIのURLへ変更する必要があります。
 */
const API_URL =
  'http://localhost/ar-stamp-admin/api/spots.php';

/**
 * 本番環境ではスマートフォン・タブレットのみ利用可能にする
 * localhostやローカルIPではPCからも確認可能
 */
const isDevelopment =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname.startsWith('192.168.');

const isMobileOrTablet =
  /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent
  );

if (!isDevelopment && !isMobileOrTablet) {
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
   基本設定
=========================== */

const totalStampCount = 3;

/**
 * APIから取得したクイズ情報を保存する
 *
 * 例：
 * quizData['quiz-1']
 * quizData['quiz-2']
 */
const quizData = {};

/* ===========================
   HTML要素
=========================== */

const arTargets =
  document.querySelectorAll('.ar-target');

const followingCharacter =
  document.querySelector(
    '#following-character'
  );

const scanGuide =
  document.querySelector('#scan-guide');

const quizModal =
  document.querySelector('#quiz-modal');

const quizQuestion =
  document.querySelector('#quiz-question');

const quizOptions =
  document.querySelector('#quiz-options');

const quizResult =
  document.querySelector('#quiz-result');

const quizCloseButton =
  document.querySelector(
    '#quiz-close-button'
  );

const stampBookButton =
  document.querySelector(
    '#stamp-book-button'
  );

const stampModal =
  document.querySelector('#stamp-modal');

const stampCloseButton =
  document.querySelector(
    '#stamp-close-button'
  );

const stampCount =
  document.querySelector('#stamp-count');

const stampModalCount =
  document.querySelector(
    '#stamp-modal-count'
  );

const stampItems =
  document.querySelectorAll('.stamp-item');

const completeMessage =
  document.querySelector(
    '#complete-message'
  );

/* ===========================
   状態管理
=========================== */

let currentQuizId = null;
let quizAnswered = false;
let apiLoaded = false;

/* ===========================
   API通信
=========================== */

/**
 * 管理画面APIからスポット情報を取得する
 */
const fetchSpots = async () => {
  const response = await fetch(
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

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      data.message ??
        'スポット情報を取得できませんでした。'
    );
  }

  if (!Array.isArray(data.spots)) {
    throw new Error(
      'APIのスポット情報が正しい形式ではありません。'
    );
  }

  return data.spots;
};

/**
 * 空の文字列やnullを除外する
 */
const normalizeOptions = (options) => {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option) => {
    return (
      typeof option === 'string' &&
      option.trim() !== ''
    );
  });
};

/**
 * APIデータをクイズ設定へ変換する
 */
const createQuizDataFromSpots = (spots) => {
  /*
   * 再読み込み時に以前の情報を消す
   */
  Object.keys(quizData).forEach(
    (quizId) => {
      delete quizData[quizId];
    }
  );

  spots.forEach((spot) => {
    const targetIndex =
      Number(spot.targetIndex);

    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0
    ) {
      console.warn(
        'targetIndexが正しくありません。',
        spot
      );

      return;
    }

    /*
     * targetIndex: 0 → quiz-1
     * targetIndex: 1 → quiz-2
     */
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

    quizData[quizId] = {
      question:
        spot.quiz?.question ??
        '問題が登録されていません。',

      options,

      correctAnswer:
        spot.quiz?.correctAnswer ?? '',

      stampId,

      spotId: Number(spot.id),

      title:
        spot.title ??
        `スポット${quizNumber}`,

      targetIndex,

      stampName:
        spot.stamp?.name ??
        spot.title ??
        `スポット${quizNumber}`,

      stampImagePath:
        spot.stamp?.imagePath ?? '',
    };
  });

  console.log(
    'APIデータからクイズ設定を作成しました。',
    quizData
  );
};

/**
 * 管理画面側の画像パスを
 * AR画面で使えるURLへ変換する
 */
const convertAssetUrl = (path) => {
  if (
    typeof path !== 'string' ||
    path.trim() === ''
  ) {
    return '';
  }

  if (
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }

  /*
   * 管理画面のuploadsフォルダにある画像
   */
  if (
    path.startsWith('./uploads/')
  ) {
    return (
      'http://localhost/ar-stamp-admin/' +
      path.replace('./', '')
    );
  }

  if (
    path.startsWith('/uploads/')
  ) {
    return (
      'http://localhost/ar-stamp-admin' +
      path
    );
  }

  /*
   * AR本体のpublic内にある画像
   */
  return path;
};

/**
 * APIのスポット名・スタンプ画像を
 * スタンプ台紙へ反映する
 */
const applySpotDataToStampBook = () => {
  Object.values(quizData).forEach(
    (quiz) => {
      const stampItem =
        document.querySelector(
          `[data-stamp-id="${quiz.stampId}"]`
        );

      if (!stampItem) {
        console.warn(
          `スタンプ欄が見つかりません: ${quiz.stampId}`
        );

        return;
      }

      const stampTitle =
        stampItem.querySelector(
          '.stamp-information h3'
        );

      const stampImage =
        stampItem.querySelector(
          '.stamp-image'
        );

      if (stampTitle) {
        stampTitle.textContent =
          quiz.stampName;
      }

      if (
        stampImage &&
        quiz.stampImagePath
      ) {
        stampImage.src =
          convertAssetUrl(
            quiz.stampImagePath
          );

        stampImage.alt =
          `${quiz.stampName}のスタンプ`;
      }
    }
  );
};

/**
 * APIデータを読み込む
 */
const loadApiData = async () => {
  apiLoaded = false;

  try {
    const spots =
      await fetchSpots();

    createQuizDataFromSpots(spots);
    applySpotDataToStampBook();

    apiLoaded = true;

    console.log(
      '管理画面APIからスポット情報を読み込みました。',
      spots
    );
  } catch (error) {
    apiLoaded = false;

    console.error(
      '管理画面APIとの接続に失敗しました。',
      error
    );
  }
};

/* ===========================
   追従キャラクター
=========================== */

/**
 * 追従キャラクターを表示する
 */
const showFollowingCharacter = () => {
  if (!followingCharacter) {
    return;
  }

  followingCharacter.classList.add(
    'is-visible'
  );

  followingCharacter.setAttribute(
    'aria-hidden',
    'false'
  );
};

/**
 * 追従キャラクターを非表示にする
 */
const hideFollowingCharacter = () => {
  if (!followingCharacter) {
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

/**
 * 画像認識ガイドを表示する
 */
const showScanGuide = () => {
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

/**
 * 画像認識ガイドを非表示にする
 */
const hideScanGuide = () => {
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
 * 現在のクイズ設定を取得する
 */
const getCurrentQuiz = () => {
  if (!currentQuizId) {
    return null;
  }

  return (
    quizData[currentQuizId] ?? null
  );
};

/**
 * クイズ結果表示を初期化する
 */
const resetQuizResult = () => {
  quizResult.textContent = '';
  quizResult.className =
    'quiz-result';
};

/**
 * クイズ選択肢を生成する
 */
const createQuizOptions = (quiz) => {
  quizOptions.innerHTML = '';

  if (quiz.options.length === 0) {
    quizResult.textContent =
      '選択肢が登録されていません。';

    quizResult.className =
      'quiz-result is-incorrect';

    return;
  }

  quiz.options.forEach((answer) => {
    const optionButton =
      document.createElement('button');

    optionButton.className =
      'quiz-option';

    optionButton.type = 'button';

    optionButton.dataset.answer =
      answer;

    optionButton.textContent =
      answer;

    optionButton.addEventListener(
      'click',
      () => {
        checkAnswer(answer);
      }
    );

    quizOptions.appendChild(
      optionButton
    );
  });
};

/**
 * クイズ画面を表示する
 */
const openQuiz = (quizId) => {
  hideScanGuide();

  /*
   * APIがまだ読み込み中の場合
   */
  if (!apiLoaded) {
    currentQuizId = null;

    quizQuestion.textContent =
      '問題情報を読み込んでいます。';

    quizOptions.innerHTML = '';

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

  const quiz = quizData[quizId];

  if (!quiz) {
    currentQuizId = null;

    quizQuestion.textContent =
      'このポスターに対応する問題がありません。';

    quizOptions.innerHTML = '';

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
    currentQuizId === quizId
  ) {
    return;
  }

  currentQuizId = quizId;
  quizAnswered = false;

  quizQuestion.textContent =
    quiz.question;

  resetQuizResult();
  createQuizOptions(quiz);

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
 * クイズ画面を閉じる
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
 * クイズの選択肢を押せない状態にする
 */
const disableOptions = () => {
  const optionButtons =
    quizOptions.querySelectorAll(
      '.quiz-option'
    );

  optionButtons.forEach((option) => {
    option.disabled = true;
  });
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
 * スタンプを保存する
 */
const saveStamp = (stampId) => {
  localStorage.setItem(
    stampId,
    'completed'
  );

  updateStampBook();
};

/**
 * 指定したスタンプを取得済みか確認する
 */
const isStampCompleted = (stampId) => {
  return (
    localStorage.getItem(stampId) ===
    'completed'
  );
};

/**
 * スタンプ台紙の表示を更新する
 */
const updateStampBook = () => {
  let completedStampCount = 0;

  stampItems.forEach((stampItem) => {
    const stampId =
      stampItem.dataset.stampId;

    const stampStatus =
      stampItem.querySelector(
        '.stamp-status'
      );

    const completed =
      isStampCompleted(stampId);

    if (completed) {
      completedStampCount += 1;

      stampItem.classList.add(
        'completed'
      );

      if (stampStatus) {
        stampStatus.textContent =
          '獲得済み';
      }
    } else {
      stampItem.classList.remove(
        'completed'
      );

      if (stampStatus) {
        stampStatus.textContent =
          '未獲得';
      }
    }
  });

  stampCount.textContent =
    `${completedStampCount} / ${totalStampCount}`;

  stampModalCount.textContent =
    `${completedStampCount} / ${totalStampCount}`;

  if (
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

/**
 * スタンプ押印アニメーションを実行する
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

  window.setTimeout(() => {
    saveStamp(stampId);
  }, 650);

  window.setTimeout(() => {
    stampItem.classList.remove(
      'is-stamping'
    );
  }, 950);
};

/**
 * 正解後にスタンプ台紙を開き、
 * スタンプ押印演出を実行する
 */
const showStampAcquisition = (
  stampId
) => {
  window.setTimeout(() => {
    closeQuiz();
    openStampBook();

    window.setTimeout(() => {
      playStampAnimation(stampId);
    }, 400);
  }, 900);
};

/**
 * 回答が正解か判定する
 */
const checkAnswer = (
  selectedAnswer
) => {
  if (quizAnswered) {
    return;
  }

  const quiz = getCurrentQuiz();

  if (!quiz) {
    console.error(
      '現在のクイズ設定を取得できません。'
    );

    return;
  }

  quizAnswered = true;

  disableOptions();

  if (
    selectedAnswer ===
    quiz.correctAnswer
  ) {
    if (
      isStampCompleted(quiz.stampId)
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
   AR画像認識イベント
=========================== */

arTargets.forEach((arTarget) => {
  const quizId =
    arTarget.dataset.quizId;

  arTarget.addEventListener(
    'targetFound',
    () => {
      console.log(
        `認識画像を発見しました: ${quizId}`
      );

      /*
       * 認識中はAR上のさだモンを表示するため、
       * 画面固定のさだモンは隠す
       */
      hideFollowingCharacter();

      hideScanGuide();
      openQuiz(quizId);
    }
  );

  arTarget.addEventListener(
    'targetLost',
    () => {
      console.log(
        `認識画像を見失いました: ${quizId}`
      );

      /*
       * ポスターを見失った後は、
       * 画面中央固定のさだモンを表示する
       */
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
});

/* ===========================
   ボタン・キー操作
=========================== */

quizCloseButton.addEventListener(
  'click',
  () => {
    closeQuiz();
  }
);

stampBookButton.addEventListener(
  'click',
  () => {
    openStampBook();
  }
);

stampCloseButton.addEventListener(
  'click',
  () => {
    closeStampBook();
  }
);

stampModal.addEventListener(
  'click',
  (event) => {
    if (event.target === stampModal) {
      closeStampBook();
    }
  }
);

document.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (
      stampModal.classList.contains(
        'is-visible'
      )
    ) {
      closeStampBook();

      return;
    }

    if (
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

const initializeApp = async () => {
  updateStampBook();
  showScanGuide();
  hideFollowingCharacter();

  await loadApiData();

  console.log(
    '管理画面API・追従キャラクター対応のMindARスタンプラリーを起動しました。'
  );
};

initializeApp();

/*
 * すべてのスタンプをリセットする場合
 *
 * localStorage.clear();
 * updateStampBook();
 */