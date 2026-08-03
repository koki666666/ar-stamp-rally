import './style.css';

const totalStampCount = 3;

/**
 * 認識画像ごとのクイズ設定
 */
const quizData = {
  'quiz-1': {
    question: '島根県の県庁所在地はどこでしょう？',
    options: ['出雲市', '松江市', '浜田市'],
    correctAnswer: '松江市',
    stampId: 'stamp-spot-1',
  },

  'quiz-2': {
    question: '島根県にある世界遺産はどれでしょう？',
    options: ['石見銀山', '厳島神社', '姫路城'],
    correctAnswer: '石見銀山',
    stampId: 'stamp-spot-2',
  },
};

const arTargets = document.querySelectorAll('.ar-target');
const characterModels =
  document.querySelectorAll('.character-model');

const scanGuide = document.querySelector('#scan-guide');

const quizModal = document.querySelector('#quiz-modal');
const quizQuestion =
  document.querySelector('#quiz-question');
const quizOptions =
  document.querySelector('#quiz-options');
const quizResult =
  document.querySelector('#quiz-result');
const quizCloseButton =
  document.querySelector('#quiz-close-button');

const stampBookButton = document.querySelector(
  '#stamp-book-button'
);
const stampModal =
  document.querySelector('#stamp-modal');
const stampCloseButton = document.querySelector(
  '#stamp-close-button'
);

const stampCount =
  document.querySelector('#stamp-count');
const stampModalCount = document.querySelector(
  '#stamp-modal-count'
);
const stampItems =
  document.querySelectorAll('.stamp-item');
const completeMessage = document.querySelector(
  '#complete-message'
);

let currentQuizId = null;
let quizAnswered = false;

/**
 * 画像認識ガイドを表示する
 */
const showScanGuide = () => {
  if (!scanGuide) {
    return;
  }

  scanGuide.classList.remove('is-hidden');
  scanGuide.setAttribute('aria-hidden', 'false');
};

/**
 * 画像認識ガイドを非表示にする
 */
const hideScanGuide = () => {
  if (!scanGuide) {
    return;
  }

  scanGuide.classList.add('is-hidden');
  scanGuide.setAttribute('aria-hidden', 'true');
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

    optionButton.className = 'quiz-option';
    optionButton.type = 'button';
    optionButton.dataset.answer = answer;
    optionButton.textContent = answer;

    optionButton.addEventListener('click', () => {
      checkAnswer(answer);
    });

    quizOptions.appendChild(optionButton);
  });
};

/**
 * クイズ画面を表示する
 */
const openQuiz = (quizId) => {
  const quiz = quizData[quizId];

  if (!quiz) {
    console.error(
      `クイズ設定が見つかりません: ${quizId}`
    );

    return;
  }

  if (
    quizModal.classList.contains('is-visible') &&
    currentQuizId === quizId
  ) {
    return;
  }

  currentQuizId = quizId;
  quizAnswered = false;

  quizQuestion.textContent = quiz.question;

  resetQuizResult();
  createQuizOptions(quiz);

  hideScanGuide();

  quizModal.classList.add('is-visible');
  quizModal.setAttribute('aria-hidden', 'false');

  console.log(
    `クイズを表示しました: ${quizId}`
  );
};

/**
 * クイズ画面を閉じる
 */
const closeQuiz = () => {
  quizModal.classList.remove('is-visible');
  quizModal.setAttribute('aria-hidden', 'true');

  showScanGuide();
};

/**
 * スタンプ台紙を開く
 */
const openStampBook = () => {
  updateStampBook();

  hideScanGuide();

  stampModal.classList.add('is-visible');
  stampModal.setAttribute('aria-hidden', 'false');
};

/**
 * スタンプ台紙を閉じる
 */
const closeStampBook = () => {
  stampModal.classList.remove('is-visible');
  stampModal.setAttribute('aria-hidden', 'true');

  showScanGuide();
};

/**
 * クイズの選択肢を押せない状態にする
 */
const disableOptions = () => {
  const optionButtons =
    quizOptions.querySelectorAll('.quiz-option');

  optionButtons.forEach((option) => {
    option.disabled = true;
  });
};

/**
 * スタンプを保存する
 */
const saveStamp = (stampId) => {
  localStorage.setItem(stampId, 'completed');

  updateStampBook();
};

/**
 * 指定したスタンプを取得済みか確認する
 */
const isStampCompleted = (stampId) => {
  return (
    localStorage.getItem(stampId) === 'completed'
  );
};

/**
 * スタンプ台紙の表示を更新する
 */
const updateStampBook = () => {
  let completedStampCount = 0;

  stampItems.forEach((stampItem) => {
    const stampId = stampItem.dataset.stampId;
    const stampStatus =
      stampItem.querySelector('.stamp-status');

    const completed =
      isStampCompleted(stampId);

    if (completed) {
      completedStampCount += 1;

      stampItem.classList.add('completed');
      stampStatus.textContent = '獲得済み';
    } else {
      stampItem.classList.remove('completed');
      stampStatus.textContent = '未獲得';
    }
  });

  stampCount.textContent =
    `${completedStampCount} / ${totalStampCount}`;

  stampModalCount.textContent =
    `${completedStampCount} / ${totalStampCount}`;

  if (completedStampCount === totalStampCount) {
    completeMessage.classList.add('show');
  } else {
    completeMessage.classList.remove('show');
  }
};

/**
 * スタンプ押印アニメーションを実行する
 */
const playStampAnimation = (stampId) => {
  const stampItem = document.querySelector(
    `[data-stamp-id="${stampId}"]`
  );

  if (!stampItem) {
    console.error(
      `スタンプ要素が見つかりません: ${stampId}`
    );

    return;
  }

  stampItem.classList.remove('is-stamping');

  void stampItem.offsetWidth;

  stampItem.classList.add('is-stamping');

  window.setTimeout(() => {
    saveStamp(stampId);
  }, 650);

  window.setTimeout(() => {
    stampItem.classList.remove('is-stamping');
  }, 950);
};

/**
 * 正解後にスタンプ台紙を開き、
 * スタンプ押印演出を実行する
 */
const showStampAcquisition = (stampId) => {
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
const checkAnswer = (selectedAnswer) => {
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

  if (selectedAnswer === quiz.correctAnswer) {
    if (isStampCompleted(quiz.stampId)) {
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

    showStampAcquisition(quiz.stampId);

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
characterModels.forEach((characterModel, index) => {
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
});

/**
 * 各認識画像のイベントを登録する
 */
arTargets.forEach((arTarget) => {
  const quizId = arTarget.dataset.quizId;

  arTarget.addEventListener('targetFound', () => {
    console.log(
      `認識画像を発見しました: ${quizId}`
    );

    hideScanGuide();
    openQuiz(quizId);
  });

  arTarget.addEventListener('targetLost', () => {
    console.log(
      `認識画像を見失いました: ${quizId}`
    );

    if (
      !quizModal.classList.contains('is-visible') &&
      !stampModal.classList.contains('is-visible')
    ) {
      showScanGuide();
    }
  });
});

/**
 * クイズの閉じるボタン
 */
quizCloseButton.addEventListener('click', () => {
  closeQuiz();
});

/**
 * スタンプ台紙を開くボタン
 */
stampBookButton.addEventListener('click', () => {
  openStampBook();
});

/**
 * スタンプ台紙を閉じるボタン
 */
stampCloseButton.addEventListener('click', () => {
  closeStampBook();
});

/**
 * スタンプ台紙の背景部分を押したとき
 */
stampModal.addEventListener('click', (event) => {
  if (event.target === stampModal) {
    closeStampBook();
  }
});

/**
 * Escapeキーを押したとき
 */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (
    stampModal.classList.contains('is-visible')
  ) {
    closeStampBook();

    return;
  }

  if (
    quizModal.classList.contains('is-visible')
  ) {
    closeQuiz();
  }
});

/**
 * ページを開いたときに、
 * 保存済みのスタンプ状態を読み込む
 */
updateStampBook();
showScanGuide();

/*
 * スポット1だけリセットする場合
 *
 * localStorage.removeItem('stamp-spot-1');
 * updateStampBook();
 */

/*
 * スポット2だけリセットする場合
 *
 * localStorage.removeItem('stamp-spot-2');
 * updateStampBook();
 */

/*
 * すべてのスタンプをリセットする場合
 *
 */
// localStorage.clear();
// updateStampBook();


console.log(
  '画像認識ガイド付きのMindARスタンプラリーを起動しました。'
);