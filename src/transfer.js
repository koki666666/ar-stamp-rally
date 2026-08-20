/* ===========================
   データ引き継ぎ機能
=========================== */

const isLocalTransfer =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname.startsWith('192.168.');

const TRANSFER_ADMIN_BASE_URL =
  isLocalTransfer
    ? `http://${location.hostname}/ar-stamp-admin`
    : 'https://m-shokai.jp/ar-stamp-admin';
    
const CREATE_TRANSFER_API =
  `${TRANSFER_ADMIN_BASE_URL}/api/create-transfer-code.php`;

const RESTORE_TRANSFER_API =
  `${TRANSFER_ADMIN_BASE_URL}/api/restore-transfer.php`;

const PARTICIPANT_STORAGE_KEY =
  'ar-stamp-participant-key';

/* ===========================
   CSS追加
=========================== */

const addTransferStyles = () => {
  const style =
    document.createElement(
      'style'
    );

  style.textContent = `
    .transfer-button {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 10000;

      border: none;
      border-radius: 999px;

      padding: 12px 18px;

      background: rgba(255,255,255,0.95);
      color: #222;

      font-size: 14px;
      font-weight: 700;

      box-shadow:
        0 5px 18px
        rgba(0,0,0,0.15);

      cursor: pointer;
    }

    .transfer-overlay {
      position: fixed;
      inset: 0;
      z-index: 20000;

      display: none;
      align-items: center;
      justify-content: center;

      padding: 20px;

      background:
        rgba(0,0,0,0.5);
    }

    .transfer-overlay.is-visible {
      display: flex;
    }

    .transfer-modal {
      width: min(
        100%,
        420px
      );

      max-height: 85vh;
      overflow-y: auto;

      padding: 24px;

      background: #fff;

      border-radius: 24px;

      box-shadow:
        0 12px 40px
        rgba(0,0,0,0.25);
    }

    .transfer-modal h2 {
      margin:
        0 0 8px;

      font-size: 22px;
    }

    .transfer-description {
      margin:
        0 0 24px;

      color: #666;

      font-size: 14px;
      line-height: 1.7;
    }

    .transfer-section {
      padding:
        18px 0;

      border-top:
        1px solid #eee;
    }

    .transfer-section:first-of-type {
      border-top: none;
    }

    .transfer-section h3 {
      margin:
        0 0 8px;

      font-size: 17px;
    }

    .transfer-section p {
      margin:
        0 0 14px;

      color: #666;

      font-size: 13px;
      line-height: 1.6;
    }

    .transfer-primary-button {
      width: 100%;

      padding:
        14px 16px;

      border: none;
      border-radius: 14px;

      background: #3b82f6;
      color: #fff;

      font-size: 15px;
      font-weight: 700;

      cursor: pointer;
    }

    .transfer-primary-button:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .transfer-code-display {
      display: none;

      margin-top: 15px;

      padding: 16px;

      border-radius: 14px;

      background: #f3f6ff;

      text-align: center;

      font-size: 26px;
      font-weight: 800;

      letter-spacing: 2px;

      color: #315dd8;
    }

    .transfer-code-display.is-visible {
      display: block;
    }

    .transfer-input {
      width: 100%;

      box-sizing: border-box;

      margin-bottom: 12px;

      padding:
        14px 16px;

      border:
        2px solid #ddd;

      border-radius: 14px;

      background: #fff;

      font-size: 18px;
      font-weight: 700;

      text-align: center;
      text-transform: uppercase;

      letter-spacing: 2px;
    }

    .transfer-input:focus {
      outline: none;

      border-color:
        #3b82f6;
    }

    .transfer-message {
      min-height: 22px;

      margin-top: 14px;

      font-size: 13px;
      line-height: 1.5;
    }

    .transfer-message.is-success {
      color: #15803d;
    }

    .transfer-message.is-error {
      color: #dc2626;
    }

    .transfer-close-button {
      width: 100%;

      margin-top: 16px;

      padding: 12px;

      border:
        1px solid #ddd;

      border-radius: 14px;

      background: #fff;
      color: #444;

      font-weight: 700;

      cursor: pointer;
    }
  `;

  document.head.appendChild(
    style
  );
};

/* ===========================
   UI生成
=========================== */

const createTransferUi = () => {
  const button =
    document.createElement(
      'button'
    );

  button.type =
    'button';

  button.className =
    'transfer-button';

  button.textContent =
    'データ引き継ぎ';

  const overlay =
    document.createElement(
      'div'
    );

  overlay.className =
    'transfer-overlay';

  overlay.innerHTML = `
    <div class="transfer-modal">

      <h2>
        データ引き継ぎ
      </h2>

      <p class="transfer-description">
        機種変更などを行う場合、
        引き継ぎコードを利用して
        スタンプの進捗を別端末へ移行できます。
      </p>

      <section class="transfer-section">

        <h3>
          この端末から引き継ぐ
        </h3>

        <p>
          現在の進捗に紐づく
          引き継ぎコードを発行します。
        </p>

        <button
          id="create-transfer-button"
          class="transfer-primary-button"
          type="button"
        >
          引き継ぎコードを発行
        </button>

        <div
          id="transfer-code-display"
          class="transfer-code-display"
        >
        </div>

        <div
          id="create-transfer-message"
          class="transfer-message"
        >
        </div>

      </section>

      <section class="transfer-section">

        <h3>
          別の端末から引き継ぐ
        </h3>

        <p>
          以前の端末で発行した
          引き継ぎコードを入力してください。
        </p>

        <input
          id="transfer-code-input"
          class="transfer-input"
          type="text"
          maxlength="9"
          placeholder="XXXX-XXXX"
          autocomplete="off"
        >

        <button
          id="restore-transfer-button"
          class="transfer-primary-button"
          type="button"
        >
          データを引き継ぐ
        </button>

        <div
          id="restore-transfer-message"
          class="transfer-message"
        >
        </div>

      </section>

      <button
        id="transfer-close-button"
        class="transfer-close-button"
        type="button"
      >
        閉じる
      </button>

    </div>
  `;

  document.body.appendChild(
    button
  );

  document.body.appendChild(
    overlay
  );

  return {
    button,
    overlay,

    createButton:
      overlay.querySelector(
        '#create-transfer-button'
      ),

    codeDisplay:
      overlay.querySelector(
        '#transfer-code-display'
      ),

    createMessage:
      overlay.querySelector(
        '#create-transfer-message'
      ),

    codeInput:
      overlay.querySelector(
        '#transfer-code-input'
      ),

    restoreButton:
      overlay.querySelector(
        '#restore-transfer-button'
      ),

    restoreMessage:
      overlay.querySelector(
        '#restore-transfer-message'
      ),

    closeButton:
      overlay.querySelector(
        '#transfer-close-button'
      ),
  };
};

/* ===========================
   メッセージ表示
=========================== */

const setTransferMessage = (
  element,
  message,
  type = ''
) => {
  element.textContent =
    message;

  element.classList.remove(
    'is-success',
    'is-error'
  );

  if (
    type === 'success'
  ) {
    element.classList.add(
      'is-success'
    );
  }

  if (
    type === 'error'
  ) {
    element.classList.add(
      'is-error'
    );
  }
};

/* ===========================
   コード整形
=========================== */

const formatTransferCode = (
  value
) => {
  const normalized =
    value
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        ''
      )
      .slice(
        0,
        8
      );

  if (
    normalized.length <= 4
  ) {
    return normalized;
  }

  return (
    normalized.slice(
      0,
      4
    ) +
    '-' +
    normalized.slice(
      4
    )
  );
};

/* ===========================
   引き継ぎコード発行
=========================== */

const createTransferCode =
  async (
    elements
  ) => {
    const participantKey =
      localStorage.getItem(
        PARTICIPANT_STORAGE_KEY
      );

    if (
      !participantKey
    ) {
      setTransferMessage(
        elements.createMessage,
        '参加者情報が見つかりません。',
        'error'
      );

      return;
    }

    elements.createButton.disabled =
      true;

    setTransferMessage(
      elements.createMessage,
      'コードを発行しています…'
    );

    try {
      const response =
        await fetch(
          CREATE_TRANSFER_API,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                participantKey,
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
          '引き継ぎコードを発行できませんでした。'
        );
      }

      elements.codeDisplay.textContent =
        data.transferCode;

      elements.codeDisplay.classList.add(
        'is-visible'
      );

      setTransferMessage(
        elements.createMessage,
        'このコードを新しい端末で入力してください。',
        'success'
      );

    } catch (
      error
    ) {
      console.error(
        error
      );

      setTransferMessage(
        elements.createMessage,
        error.message ??
        '引き継ぎコードを発行できませんでした。',
        'error'
      );
    } finally {
      elements.createButton.disabled =
        false;
    }
  };

/* ===========================
   引き継ぎ実行
=========================== */

const restoreTransfer =
  async (
    elements
  ) => {
    const transferCode =
      formatTransferCode(
        elements.codeInput.value
      );

    if (
      !/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(
        transferCode
      )
    ) {
      setTransferMessage(
        elements.restoreMessage,
        'XXXX-XXXX形式で入力してください。',
        'error'
      );

      return;
    }

    elements.restoreButton.disabled =
      true;

    setTransferMessage(
      elements.restoreMessage,
      '引き継ぎ情報を確認しています…'
    );

    try {
      const response =
        await fetch(
          RESTORE_TRANSFER_API,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                transferCode,
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
          '引き継ぎに失敗しました。'
        );
      }

      if (
        !data.participantKey
      ) {
        throw new Error(
          '参加者情報を取得できませんでした。'
        );
      }

      /*
       * 新端末のparticipantKeyを
       * 元端末のparticipantKeyへ変更
       */
      localStorage.setItem(
        PARTICIPANT_STORAGE_KEY,
        data.participantKey
      );

      /*
       * 古い端末側のスタンプLocalStorageが
       * 新端末にはないため、
       * ページ再読み込み後に
       * get-progress.phpからDB進捗を復元する。
       */

      setTransferMessage(
        elements.restoreMessage,
        `引き継ぎに成功しました。スタンプ ${data.count ?? 0} 件を復元します。`,
        'success'
      );

      window.setTimeout(
        () => {
          window.location.reload();
        },
        1200
      );

    } catch (
      error
    ) {
      console.error(
        error
      );

      setTransferMessage(
        elements.restoreMessage,
        error.message ??
        '引き継ぎに失敗しました。',
        'error'
      );

      elements.restoreButton.disabled =
        false;
    }
  };

/* ===========================
   初期化
=========================== */

const initializeTransfer =
  () => {
    addTransferStyles();

    const elements =
      createTransferUi();

    /*
     * モーダルを開く
     */
    elements.button.addEventListener(
      'click',
      () => {
        elements.overlay.classList.add(
          'is-visible'
        );
      }
    );

    /*
     * モーダルを閉じる
     */
    elements.closeButton.addEventListener(
      'click',
      () => {
        elements.overlay.classList.remove(
          'is-visible'
        );
      }
    );

    /*
     * 背景タップで閉じる
     */
    elements.overlay.addEventListener(
      'click',
      (
        event
      ) => {
        if (
          event.target ===
          elements.overlay
        ) {
          elements.overlay.classList.remove(
            'is-visible'
          );
        }
      }
    );

    /*
     * コード入力時に
     * XXXX-XXXX形式へ整形
     */
    elements.codeInput.addEventListener(
      'input',
      () => {
        elements.codeInput.value =
          formatTransferCode(
            elements.codeInput.value
          );
      }
    );

    /*
     * 引き継ぎコード発行
     */
    elements.createButton.addEventListener(
      'click',
      () => {
        createTransferCode(
          elements
        );
      }
    );

    /*
     * 引き継ぎ実行
     */
    elements.restoreButton.addEventListener(
      'click',
      () => {
        restoreTransfer(
          elements
        );
      }
    );

    console.log(
      'データ引き継ぎ機能を初期化しました。'
    );
  };

initializeTransfer();