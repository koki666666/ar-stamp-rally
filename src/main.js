import './style.css';

const correctAnswer = '松江市';

const arTarget = document.querySelector('#ar-target');
const quizModal = document.querySelector('#quiz-modal');
const quizOptions = document.querySelectorAll('.quiz-option');
const quizResult = document.querySelector('#quiz-result');
const closeButton = document.querySelector('#quiz-close-button');

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
 * 選択肢を押せない状態にする
 */
const disableOptions = () => {
  quizOptions.forEach((option) => {
    option.disabled = true;
  });
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
    quizResult.textContent = '正解！スタンプを獲得しました！';
    quizResult.className = 'quiz-result is-correct';

    localStorage.setItem('stamp-spot-1', 'completed');
  } else {
    quizResult.textContent = '不正解です。正解は松江市です。';
    quizResult.className = 'quiz-result is-incorrect';
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
 * 選択肢を押したとき
 */
quizOptions.forEach((option) => {
  option.addEventListener('click', () => {
    const selectedAnswer = option.dataset.answer;

    checkAnswer(selectedAnswer);
  });
});

/**
 * 閉じるボタンを押したとき
 */
closeButton.addEventListener('click', () => {
  closeQuiz();
});

console.log('MindARクイズを起動しました。');