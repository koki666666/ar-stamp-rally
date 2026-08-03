import './style.css';

/**
 * PCローカル確認用API
 *
 * Vercelやスマホから利用する場合は、
 * localhostではアクセスできないため後から変更が必要。
 */
const API_URL =
  'http://localhost/ar-stamp-admin/api/spots.php';

const totalStampCount = 3;

/**
 * APIから取得したクイズ情報を保存する
 *
 * 例：
 * quizData['quiz-1']
 * quizData['quiz-2']
 */
const quizData = {};

const arTargets =
  document.querySelectorAll('.ar-target');

const characterModels =
  document.querySelectorAll('.character-model');

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
  document.querySelector('#quiz-close-button');

const stampBookButton =
  document.querySelector('#stamp-book-button');

const stampModal =
  document.querySelector('#stamp-modal');

const stampCloseButton =
  document.querySelector('#stamp-close-button');

const stampCount =
  document.querySelector('#stamp-count');

const stampModalCount =
  document.querySelector('#stamp-modal-count');

const stampItems =
  document.querySelectorAll('.stamp-item');

const completeMessage =
  document.querySelector('#complete-message');

let currentQuizId = null;
let quizAnswered = false;
let apiLoaded = false;

/**
 * 管理画面APIからスポット情報を取得する
 */
const fetchSpots = async () => {
  const response = await fetch(API_URL);

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

  return data.spots;
};

/**
 * APIのデータをクイズ設定へ変換する
 */
const createQuizDataFromSpots = (spots) => {
  spots.forEach((spot) => {
    /*
     * targetIndexが0ならquiz-1
     * targetIndexが1ならquiz-2
     */
    const quizId =
      `quiz-${spot.targetIndex + 1}`;

    quizData[quizId] = {
      question:
        spot.quiz?.question ??
        '問題が登録されていません。',

      options:
        spot.quiz?.options?.filter(
          (option) =>
            typeof option === 'string' &&
            option.trim() !== ''
        ) ?? [],

      correctAnswer:
        spot.quiz?.correctAnswer ?? '',

      /*
       * DBのスポットIDをスタンプIDに対応させる
       *
       * ID 1 → stamp-spot-1
       * ID 2 → stamp-spot-2
       */
      stampId: `stamp-spot-${spot.id}`,

      spotId: spot.id,
      title: spot.title,
      targetIndex: spot.targetIndex,

      modelPath: spot.modelPath,

      stampName:
        spot.stamp?.name ??
        `スポット${spot.id}`,

      stampImagePath:
        spot.stamp?.imagePath ?? null,
    };
  });

  console.log(
    'APIデータからクイズ設定を作成しました。',
    quizData
  );
};

/**
 * スタンプ台紙へAPIの情報を反映する
 */
const applySpotDataToStampBook = () => {
  Object.values(quizData).forEach((quiz) => {
    const stampItem = document.querySelector(
      `[data-stamp-id="${quiz.stampId}"]`
    );

    if (!stampItem) {
      console.warn(
        `対応するスタンプ要素がありません: ${quiz.stampId}`
      );

      return;
    }

    const stampTitle =
      stampItem.querySelector(
        '.stamp-information h3'
      );

    const stampImage =
      stampItem.querySelector('.stamp-image');

    if (stampTitle) {
      stampTitle.textContent = quiz.stampName;
    }

    if (
      stampImage &&
      quiz.stampImagePath
    ) {
      stampImage.src =
        convertAdminAssetUrl(
          quiz.stampImagePath
        );

      stampImage.alt =
        `${quiz.stampName}のスタンプ`;
    }
  });
};

/**
 * 管理画面側の画像パスを
 * AR側から取得できるURLへ変換する
 */
const convertAdminAssetUrl = (path) => {
  if (!path) {
    return '';
  }

  if (
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }

  /*
   * 管理画面でアップロードした画像
   * ./uploads/example.png
   */
  if (path.startsWith('./uploads/')) {
    return (
      'http://localhost/ar-stamp-admin/' +
      path.replace('./', '')
    );
  }

  /*
   * /images/...など、現在AR本体にある素材は
   * そのまま利用する
   */
  return path;
};

/**
 * APIデータを読み込む
 */
const loadApiData = async () => {
  try {
    const spots = await fetchSpots();

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
      'スポット情報の取得に失敗しました。',
      error
    );
  }
};

/**
 * 画像認識ガイドを表示する
 */
const showScanGuide = () => {
  if (!scanGuide) {
    return;
  }

  scanGuide.classList.remove('is-hidden');
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

  scanGuide.classList.add('is-hidden');
  scanGuide.setAttribute(
    'aria-hidden',
    'true'
  );
};

/**
 * 現在のクイズ設定を取得する
 */
const getCurrentQuiz = () => {
  if (!currentQuizId) {
    return null;
  }

  return quizData[currentQuizId] ?? null;
};

/**
 * クイズ結果表示を初期化する
 */
const resetQuizResult = () => {
  quizResult.textContent = '';
  quizResult.className = 'quiz-result';
};

/**
 * クイズ選択肢を生成する
 */
const createQuizOptions = (quiz) => {
  quizOptions.innerHTML = '';

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
  if (!apiLoaded) {
    console.warn(
      'APIデータをまだ読み込めていません。'
    );

    quizQuestion.textContent =
      '問題情報を読み込んでいます。';

    quizOptions.innerHTML = '';

    quizResult.textContent =
      '少し待ってから、もう一度画像を映してください。';

    quizResult.className =
      'quiz-result is-incorrect';

    hideScanGuide();

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
    console.error(
      `クイズ設定が見つかりません: ${quizId}`
    );

    quizQuestion.textContent =
      'この画像に対応する問題が登録されていません。';

    quizOptions.innerHTML = '';

    quizResult.textContent = '';

    hideScanGuide();

    quizModal.classList.add(
      'is-visible'
    );

    quizModal.setAttribute(
      'aria-hidden',
      'false'
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

  hideScanGuide();

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

/**
 * 3Dモデルの読み込み状態を確認する
 */
characterModels.forEach(
  (characterModel, index) => {
    characterModel.addEventListener(
      'model-loaded',
      () => {
        console.log(
          `3Dキャラクター${index + 1}を読み込みました。`
        );
      }
    );

    characterModel.addEventListener(
      'model-error',
      (event) => {
        console.error(
          `3Dキャラクター${index + 1}の読み込みに失敗しました。`,
          event
        );
      }
    );
  }
);

/**
 * 各認識画像のイベントを登録する
 */
arTargets.forEach((arTarget) => {
  const quizId =
    arTarget.dataset.quizId;

  arTarget.addEventListener(
    'targetFound',
    () => {
      console.log(
        `認識画像を発見しました: ${quizId}`
      );

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

/**
 * クイズの閉じるボタン
 */
quizCloseButton.addEventListener(
  'click',
  () => {
    closeQuiz();
  }
);

/**
 * スタンプ台紙を開くボタン
 */
stampBookButton.addEventListener(
  'click',
  () => {
    openStampBook();
  }
);

/**
 * スタンプ台紙を閉じるボタン
 */
stampCloseButton.addEventListener(
  'click',
  () => {
    closeStampBook();
  }
);

/**
 * スタンプ台紙の背景部分を押したとき
 */
stampModal.addEventListener(
  'click',
  (event) => {
    if (event.target === stampModal) {
      closeStampBook();
    }
  }
);

/**
 * Escapeキーを押したとき
 */
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

/**
 * 初期処理
 */
const initializeApp = async () => {
  updateStampBook();
  showScanGuide();

  await loadApiData();

  console.log(
    'API連携版MindARスタンプラリーを起動しました。'
  );
};

initializeApp();

/*
 * すべてのスタンプをリセットする場合
 */

// localStorage.clear();
// updateStampBook();