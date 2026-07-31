import './style.css';

const correctAnswer = '松江市';
const totalStampCount = 3;
const currentStampId = 'stamp-spot-1';

const arTarget = document.querySelector('#ar-target');

const quizModal = document.querySelector('#quiz-modal');
const quizOptions = document.querySelectorAll('.quiz-option');
const quizResult = document.querySelector('#quiz-result');
const quizCloseButton = document.querySelector('#quiz-close-button');

const stampBookButton = document.querySelector('#stamp-book-button');
const stampModal = document.querySelector('#stamp-modal');
const stampCloseButton = document.querySelector('#stamp-close-button');

const stampCount = document.querySelector('#stamp-count');
const stampModalCount = document.querySelector('#stamp-modal-count');
const stampItems = document.querySelectorAll('.stamp-item');
const completeMessage = document.querySelector('#complete-message');

let quizOpened = false;
let quizAnswered = false;

/**
 * クイズ画面を表示する
 */
const openQuiz = () => {
  if (quizOpened) {
    return;
  }

  quizOpened = true;

  quizModal.classList.add('is-visible');
  quizModal.setAttribute('aria-hidden', 'false');
};

/**
 * クイズ画面を閉じる
 */
const closeQuiz = () => {
  quizModal.classList.remove('is-visible');
  quizModal.setAttribute('aria-hidden', 'true');
};

/**
 * スタンプ台紙を開く
 */
const openStampBook = () => {
  updateStampBook();

  stampModal.classList.add('is-visible');
  stampModal.setAttribute('aria-hidden', 'false');
};

/**
 * スタンプ台紙を閉じる
 */
const closeStampBook = () => {
  stampModal.classList.remove('is-visible');
  stampModal.setAttribute('aria-hidden', 'true');
};

/**
 * 選択肢を押せない状態にする
 */
const disableOptions = () => {
  quizOptions.forEach((option) => {
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
 * スタンプ台紙の表示を更新する
 */
const updateStampBook = () => {
  let completedStampCount = 0;

  stampItems.forEach((stampItem) => {
    const stampId = stampItem.dataset.stampId;
    const stampStatus =
      stampItem.querySelector('.stamp-status');

    const isCompleted =
      localStorage.getItem(stampId) === 'completed';

    if (isCompleted) {
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
 * スタンプを押すアニメーションを実行する
 */
const playStampAnimation = (stampId) => {
  const stampItem = document.querySelector(
    `[data-stamp-id="${stampId}"]`
  );

  if (!stampItem) {
    return;
  }

  stampItem.classList.remove('is-stamping');

  // CSSアニメーションを再実行できるように再描画させる
  void stampItem.offsetWidth;

  stampItem.classList.add('is-stamping');

  // 押印の途中でスタンプを保存する
  window.setTimeout(() => {
    saveStamp(stampId);
  }, 650);

  // アニメーション終了後にクラスを外す
  window.setTimeout(() => {
    stampItem.classList.remove('is-stamping');
  }, 950);
};

/**
 * 正解後にスタンプ台紙を開いて押印する
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

  quizAnswered = true;
  disableOptions();

  if (selectedAnswer === correctAnswer) {
    quizResult.textContent =
      '正解！スタンプを獲得しました！';

    quizResult.className =
      'quiz-result is-correct';

    showStampAcquisition(currentStampId);
  } else {
    quizResult.textContent =
      '不正解です。正解は松江市です。';

    quizResult.className =
      'quiz-result is-incorrect';
  }
};

/**
 * 認識対象の画像を見つけたとき
 */
arTarget.addEventListener('targetFound', () => {
  console.log('認識画像を発見しました。');

  openQuiz();
});

/**
 * 認識対象の画像を見失ったとき
 */
arTarget.addEventListener('targetLost', () => {
  console.log('認識画像を見失いました。');
});

/**
 * クイズの選択肢を押したとき
 */
quizOptions.forEach((option) => {
  option.addEventListener('click', () => {
    const selectedAnswer = option.dataset.answer;

    checkAnswer(selectedAnswer);
  });
});

/**
 * クイズの閉じるボタンを押したとき
 */
quizCloseButton.addEventListener('click', () => {
  closeQuiz();
});

/**
 * スタンプボタンを押したとき
 */
stampBookButton.addEventListener('click', () => {
  openStampBook();
});

/**
 * スタンプ台紙の閉じるボタンを押したとき
 */
stampCloseButton.addEventListener('click', () => {
  closeStampBook();
});

/**
 * スタンプ台紙の外側を押したとき
 */
stampModal.addEventListener('click', (event) => {
  if (event.target === stampModal) {
    closeStampBook();
  }
});

/**
 * ページを開いたときに保存状態を読み込む
 */
updateStampBook();


//localStorage.removeItem('stamp-spot-1');


console.log('MindARスタンプラリーを起動しました。');