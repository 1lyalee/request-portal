(function () {
  const API_URL = window.YILIA_REQUEST_API_URL || 'http://127.0.0.1:8787/api/requests';
  const PRIORITIES = ['不着急', '正常', '有点急', '十万火急！'];
  const MAX_ESCAPES = 3;
  const ESCAPE_MOVES = [
    { x: 96, y: -34 },
    { x: -88, y: 42 },
    { x: 72, y: 52 }
  ];

  const state = {
    selectedPriority: '',
    isSubmitting: false,
    escapeCount: 0,
    escapeOffset: { x: 0, y: 0 },
    escapeDisabled: true,
    toastTimer: null
  };

  const views = {
    landing: document.getElementById('landingView'),
    greeting: document.getElementById('greetingView'),
    form: document.getElementById('formView'),
    success: document.getElementById('successView')
  };

  const elements = {
    requestButton: document.getElementById('requestButton'),
    sayHiButton: document.getElementById('sayHiButton'),
    greetingForm: document.getElementById('greetingForm'),
    greetingMessage: document.getElementById('greetingMessage'),
    greetingBackHomeButton: document.getElementById('greetingBackHomeButton'),
    formBackHomeButton: document.getElementById('formBackHomeButton'),
    requestForm: document.getElementById('requestForm'),
    content: document.getElementById('content'),
    requesterName: document.getElementById('requesterName'),
    deadline: document.getElementById('deadline'),
    priorityGroup: document.getElementById('priorityGroup'),
    contentError: document.getElementById('contentError'),
    submissionError: document.getElementById('submissionError'),
    submitButton: document.getElementById('submitButton'),
    receiptList: document.getElementById('receiptList'),
    createAnotherButton: document.getElementById('createAnotherButton'),
    receiptBackHomeButton: document.getElementById('receiptBackHomeButton'),
    toast: document.getElementById('toast')
  };

  function init() {
    state.escapeDisabled = isTouchLikeDevice() || prefersReducedMotion();

    elements.requestButton.addEventListener('pointerenter', handleRequestButtonPointerEnter);
    elements.requestButton.addEventListener('click', showForm);
    elements.sayHiButton.addEventListener('click', function () {
      showGreeting();
    });
    elements.greetingForm.addEventListener('submit', handleGreetingSubmit);
    elements.greetingBackHomeButton.addEventListener('click', showLanding);
    elements.formBackHomeButton.addEventListener('click', showLanding);
    elements.requestForm.addEventListener('submit', handleSubmit);
    elements.content.addEventListener('input', function () {
      autoResizeTextarea(elements.content);
      clearErrors();
    });
    elements.requesterName.addEventListener('input', clearSubmissionError);
    elements.deadline.addEventListener('input', clearSubmissionError);
    elements.priorityGroup.addEventListener('click', handlePriorityClick);
    elements.createAnotherButton.addEventListener('click', resetFormAndShow);
    elements.receiptBackHomeButton.addEventListener('click', showLanding);

    showLanding();
    autoResizeTextarea(elements.content);
  }

  function showLanding() {
    showView('landing');
  }

  function showGreeting() {
    showView('greeting');
    elements.greetingMessage.focus();
  }

  function showForm() {
    showView('form');
    elements.content.focus();
  }

  function showSuccess(submittedValues) {
    renderReceipt(submittedValues);
    showView('success');
  }

  function showView(viewName) {
    resetEscapingButton();
    Object.keys(views).forEach(function (key) {
      views[key].hidden = key !== viewName;
    });
  }

  function resetEscapingButton() {
    state.escapeCount = 0;
    state.escapeOffset = { x: 0, y: 0 };
    elements.requestButton.style.transform = '';
    elements.requestButton.style.left = '';
    elements.requestButton.style.top = '';
    elements.requestButton.style.position = '';
  }

  function resetFormAndShow() {
    elements.requestForm.reset();
    state.selectedPriority = '';
    setPrioritySelection('');
    setContentError('');
    setSubmissionError('');
    setSubmitting(false);
    showForm();
  }

  function handleGreetingSubmit(event) {
    event.preventDefault();
    showToast('收到啦 👋 祝你今天开心！');
    window.setTimeout(showLanding, 700);
  }

  function handlePriorityClick(event) {
    const button = event.target.closest('[data-priority]');
    if (!button || !elements.priorityGroup.contains(button)) {
      return;
    }

    const priority = button.dataset.priority;
    if (!PRIORITIES.includes(priority)) {
      return;
    }

    setPrioritySelection(state.selectedPriority === priority ? '' : priority);
    clearSubmissionError();
  }

  function setPrioritySelection(priority) {
    state.selectedPriority = priority;
    elements.priorityGroup.querySelectorAll('[data-priority]').forEach(function (button) {
      const selected = button.dataset.priority === priority;
      button.classList.toggle('pill-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function handleRequestButtonPointerEnter(event) {
    if (state.escapeDisabled || event.pointerType !== 'mouse' || state.escapeCount >= MAX_ESCAPES) {
      return;
    }

    const nextMove = ESCAPE_MOVES[state.escapeCount] || { x: 0, y: 0 };
    const buttonRect = elements.requestButton.getBoundingClientRect();
    const padding = 8;
    const nextLeft = buttonRect.left + nextMove.x;
    const nextRight = buttonRect.right + nextMove.x;
    const nextTop = buttonRect.top + nextMove.y;
    const nextBottom = buttonRect.bottom + nextMove.y;

    const safeX =
      nextLeft < padding
        ? padding - buttonRect.left
        : nextRight > window.innerWidth - padding
          ? window.innerWidth - padding - buttonRect.right
          : nextMove.x;

    const safeY =
      nextTop < padding
        ? padding - buttonRect.top
        : nextBottom > window.innerHeight - padding
          ? window.innerHeight - padding - buttonRect.bottom
          : nextMove.y;

    state.escapeOffset = { x: safeX, y: safeY };
    state.escapeCount += 1;
    elements.requestButton.style.transform = 'translate(' + safeX + 'px, ' + safeY + 'px)';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.isSubmitting) {
      return;
    }

    const payload = buildPayload();
    if (!payload.content) {
      setContentError('请填写需求内容。');
      return;
    }

    setSubmitting(true);
    setSubmissionError('');

    const result = await submitRequest(payload);
    setSubmitting(false);

    if (!result.success) {
      setSubmissionError('提交失败了，请稍后再试。');
      return;
    }

    showSuccess(payload);
  }

  function buildPayload() {
    const content = elements.content.value.trim();
    const payload = { content: content };

    if (elements.requesterName.value) {
      payload.requesterName = elements.requesterName.value;
    }

    if (elements.deadline.value) {
      payload.deadline = elements.deadline.value;
    }

    if (state.selectedPriority) {
      payload.priority = state.selectedPriority;
    }

    return payload;
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = '33px';
    textarea.style.height = Math.max(33, textarea.scrollHeight) + 'px';
  }

  async function submitRequest(payload) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await safeReadResponseJson(response);
      if (!response.ok || !data || data.success !== true) {
        return { success: false, error: data && data.error ? data.error : 'SUBMISSION_FAILED' };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'SUBMISSION_FAILED' };
    }
  }

  async function safeReadResponseJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function renderReceipt(request) {
    elements.receiptList.textContent = '';
    addReceiptItem('需求内容', request.content);

    if (request.requesterName) {
      addReceiptItem('您的名字', request.requesterName);
    }

    if (request.deadline) {
      addReceiptItem('截至时间', request.deadline);
    }

    if (request.priority) {
      addReceiptItem('优先级', request.priority);
    }
  }

  function addReceiptItem(label, value) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');

    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    elements.receiptList.append(wrapper);
  }

  function setSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;
    elements.submitButton.disabled = isSubmitting;
    elements.submitButton.textContent = isSubmitting ? '正在提交...' : '发送';
  }

  function clearErrors() {
    setContentError('');
    clearSubmissionError();
  }

  function clearSubmissionError() {
    setSubmissionError('');
  }

  function setContentError(message) {
    elements.contentError.textContent = message;
    elements.contentError.hidden = !message;
    elements.content.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function setSubmissionError(message) {
    elements.submissionError.textContent = message;
    elements.submissionError.hidden = !message;
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    state.toastTimer = window.setTimeout(function () {
      elements.toast.hidden = true;
    }, 1700);
  }

  function isTouchLikeDevice() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
