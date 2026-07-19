(function () {
  const APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbzLgnslrbPhVF22Fo2iHGQHTjY-7EoJ3OfmKowBlLivuKInz_plZ8G8BpHFuPXDdmsy/exec';
  const PAPER_SHADERS_URL = 'https://esm.sh/@paper-design/shaders@0.0.77';
  const HOME_SHADER_SPEED = 0.14;
  const PRIORITIES = ['不着急', '正常', '有点急', '十万火急！'];
  const REQUIRED_ESCAPE_MOVES = 2;
  const BASE_ESCAPE_MOVES = [
    { x: 184, y: -72 },
    { x: -172, y: 88 },
    { x: 148, y: 108 }
  ];

  const state = {
    selectedPriority: '',
    isSubmitting: false,
    escapeCount: 0,
    escapeMoves: [],
    escapeOffset: { x: 0, y: 0 },
    escapeDisabled: true,
    toastTimer: null,
    homeShaderMount: null,
    homeShaderTried: false,
    activeView: 'landing',
    datePickerMonth: startOfMonth(new Date()),
    selectedDeadlineDate: null
  };

  const views = {
    landing: document.getElementById('landingView'),
    greeting: document.getElementById('greetingView'),
    form: document.getElementById('formView'),
    success: document.getElementById('successView')
  };

  const elements = {
    requestButton: document.getElementById('requestButton'),
    homeShaderBackground: document.getElementById('homeShaderBackground'),
    sayHiButton: document.getElementById('sayHiButton'),
    greetingForm: document.getElementById('greetingForm'),
    greetingMessage: document.getElementById('greetingMessage'),
    greetingBackHomeButton: document.getElementById('greetingBackHomeButton'),
    formBackHomeButton: document.getElementById('formBackHomeButton'),
    requestForm: document.getElementById('requestForm'),
    content: document.getElementById('content'),
    requesterName: document.getElementById('requesterName'),
    deadline: document.getElementById('deadline'),
    deadlineCalendarButton: document.getElementById('deadlineCalendarButton'),
    deadlineDatePicker: document.getElementById('deadlineDatePicker'),
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
    elements.requestButton.addEventListener('click', handleRequestButtonClick);
    elements.sayHiButton.addEventListener('click', showGreeting);
    elements.greetingForm.addEventListener('submit', handleGreetingSubmit);
    elements.greetingBackHomeButton.addEventListener('click', showLanding);
    elements.formBackHomeButton.addEventListener('click', showLanding);
    elements.requestForm.addEventListener('submit', handleSubmit);
    elements.content.addEventListener('input', function () {
      autoResizeTextarea(elements.content);
      clearErrors();
    });
    elements.requesterName.addEventListener('input', clearSubmissionError);
    elements.deadline.addEventListener('input', function () {
      state.selectedDeadlineDate = null;
      clearSubmissionError();
    });
    elements.deadlineCalendarButton.addEventListener('click', handleDatePickerToggle);
    elements.deadlineDatePicker.addEventListener('click', handleDatePickerClick);
    elements.priorityGroup.addEventListener('click', handlePriorityClick);
    elements.createAnotherButton.addEventListener('click', resetFormAndShow);
    elements.receiptBackHomeButton.addEventListener('click', showLanding);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('visibilitychange', updateHomeShaderPlayback);

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
    state.activeView = viewName;
    document.body.dataset.activeView = viewName;
    if (viewName !== 'form') {
      closeDatePicker();
    }
    Object.keys(views).forEach(function (key) {
      views[key].hidden = key !== viewName;
    });
    updateHomeShader(viewName);
  }

  function resetEscapingButton() {
    state.escapeCount = 0;
    state.escapeMoves = buildEscapeMoves();
    state.escapeOffset = { x: 0, y: 0 };
    elements.requestButton.style.transform = '';
    elements.requestButton.style.left = '';
    elements.requestButton.style.top = '';
    elements.requestButton.style.position = '';
  }

  function resetFormAndShow() {
    resetRequestForm();
    showForm();
  }

  function resetRequestForm() {
    elements.requestForm.reset();
    state.selectedPriority = '';
    state.selectedDeadlineDate = null;
    state.datePickerMonth = startOfMonth(new Date());
    setPrioritySelection('');
    closeDatePicker();
    setContentError('');
    setSubmissionError('');
    setSubmitting(false);
    autoResizeTextarea(elements.content);
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

  function handleDatePickerToggle(event) {
    event.stopPropagation();

    if (elements.deadlineDatePicker.hidden) {
      openDatePicker();
      return;
    }

    closeDatePicker();
  }

  function openDatePicker() {
    state.datePickerMonth = state.selectedDeadlineDate
      ? startOfMonth(state.selectedDeadlineDate)
      : startOfMonth(new Date());
    renderDatePicker();
    elements.deadlineDatePicker.hidden = false;
    elements.deadlineCalendarButton.setAttribute('aria-expanded', 'true');
  }

  function closeDatePicker() {
    elements.deadlineDatePicker.hidden = true;
    elements.deadlineCalendarButton.setAttribute('aria-expanded', 'false');
  }

  function handleDocumentClick(event) {
    if (
      elements.deadlineDatePicker.hidden ||
      elements.deadlineDatePicker.contains(event.target) ||
      elements.deadlineCalendarButton.contains(event.target)
    ) {
      return;
    }

    closeDatePicker();
  }

  function handleDatePickerClick(event) {
    event.stopPropagation();

    const navButton = event.target.closest('[data-calendar-nav]');
    if (navButton) {
      changeDatePickerMonth(Number(navButton.dataset.calendarNav));
      return;
    }

    const dayButton = event.target.closest('[data-calendar-date]');
    if (!dayButton) {
      return;
    }

    const selectedDate = new Date(dayButton.dataset.calendarDate + 'T00:00:00');
    state.selectedDeadlineDate = selectedDate;
    elements.deadline.value = formatDeadlineDate(selectedDate);
    clearSubmissionError();
    closeDatePicker();
  }

  function changeDatePickerMonth(monthOffset) {
    state.datePickerMonth = new Date(
      state.datePickerMonth.getFullYear(),
      state.datePickerMonth.getMonth() + monthOffset,
      1
    );
    renderDatePicker();
  }

  function renderDatePicker() {
    const month = state.datePickerMonth;
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const todayKey = toDateKey(new Date());
    const selectedKey = state.selectedDeadlineDate ? toDateKey(state.selectedDeadlineDate) : '';
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    elements.deadlineDatePicker.textContent = '';

    const header = document.createElement('div');
    header.className = 'date-picker-header';

    const previousButton = createDatePickerNavButton(-1, '上个月');
    const title = document.createElement('div');
    title.className = 'date-picker-title';
    title.textContent = year + '年' + (monthIndex + 1) + '月';
    const nextButton = createDatePickerNavButton(1, '下个月');

    header.append(previousButton, title, nextButton);
    elements.deadlineDatePicker.append(header);

    const weekdaysGrid = document.createElement('div');
    weekdaysGrid.className = 'date-picker-weekdays';
    weekdays.forEach(function (weekday) {
      const weekdayElement = document.createElement('span');
      weekdayElement.className = 'date-picker-weekday';
      weekdayElement.textContent = weekday;
      weekdaysGrid.append(weekdayElement);
    });
    elements.deadlineDatePicker.append(weekdaysGrid);

    const dayGrid = document.createElement('div');
    dayGrid.className = 'date-picker-grid';

    for (let index = 0; index < firstWeekday; index += 1) {
      dayGrid.append(document.createElement('span'));
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day);
      const dateKey = toDateKey(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'date-picker-day';
      button.dataset.calendarDate = dateKey;
      button.textContent = String(day);
      button.classList.toggle('is-today', dateKey === todayKey);
      button.classList.toggle('is-selected', dateKey === selectedKey);
      dayGrid.append(button);
    }

    elements.deadlineDatePicker.append(dayGrid);
  }

  function createDatePickerNavButton(monthOffset, ariaLabel) {
    const button = document.createElement('button');
    const icon = document.createElement('img');

    button.type = 'button';
    button.className = 'date-picker-nav';
    button.dataset.calendarNav = String(monthOffset);
    button.setAttribute('aria-label', ariaLabel);

    icon.className = 'date-picker-nav-icon';
    icon.classList.toggle('is-next', monthOffset > 0);
    icon.src = './assets/arrow_back.svg';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');

    button.append(icon);
    return button;
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
    if (
      !elements.requestButton ||
      state.escapeDisabled ||
      event.pointerType !== 'mouse' ||
      state.escapeCount >= REQUIRED_ESCAPE_MOVES
    ) {
      return;
    }

    const nextMove = state.escapeMoves[state.escapeCount] || { x: 0, y: 0 };
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

  function buildEscapeMoves() {
    const moves = BASE_ESCAPE_MOVES.map(function (move) {
      return {
        x: randomizeSignedDistance(move.x),
        y: randomizeSignedDistance(move.y)
      };
    });

    for (let index = moves.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const currentMove = moves[index];
      moves[index] = moves[swapIndex];
      moves[swapIndex] = currentMove;
    }

    return moves.slice(0, REQUIRED_ESCAPE_MOVES);
  }

  function randomizeSignedDistance(distance) {
    const sign = distance < 0 ? -1 : 1;
    const magnitude = Math.abs(distance);
    return Math.round(sign * randomBetween(magnitude * 0.68, magnitude * 1.38));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function handleRequestButtonClick(event) {
    if (!state.escapeDisabled && state.escapeCount < REQUIRED_ESCAPE_MOVES) {
      event.preventDefault();
      return;
    }

    showForm();
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
      setSubmissionError('提交失败，请稍后再试。');
      return;
    }

    showSuccess(payload);
    resetRequestForm();
  }

  function buildPayload() {
    const content = elements.content.value.trim();
    const name = elements.requesterName.value;
    const deadline = elements.deadline.value;
    const priority = state.selectedPriority;

    return {
      content: content,
      name: name,
      deadline: deadline,
      priority: priority
    };
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = '33px';
    textarea.style.height = Math.max(33, textarea.scrollHeight) + 'px';
  }

  async function updateHomeShader(viewName) {
    if (viewName !== 'landing') {
      updateHomeShaderPlayback();
      return;
    }

    if (prefersReducedMotion() || state.homeShaderTried) {
      updateHomeShaderPlayback();
      return;
    }

    state.homeShaderTried = true;

    try {
      const shaders = await import(PAPER_SHADERS_URL);
      const colors = ['#ffffff', '#FFFCD5', '#ffd6e9', '#b8fff894'].map(
        shaders.getShaderColorFromString
      );

      state.homeShaderMount = new shaders.ShaderMount(
        elements.homeShaderBackground,
        shaders.meshGradientFragmentShader,
        {
          u_colors: colors,
          u_colorsCount: colors.length,
          u_distortion: 0.04,
          u_swirl: 0.29,
          u_grainMixer: 1,
          u_grainOverlay: 0,
          u_fit: shaders.ShaderFitOptions.cover,
          u_scale: 0.32,
          u_rotation: 0,
          u_offsetX: -0.18,
          u_offsetY: -0.02,
          u_originX: 0.5,
          u_originY: 0.5,
          u_worldWidth: 1280,
          u_worldHeight: 720
        },
        undefined,
        HOME_SHADER_SPEED,
        0
      );

      elements.homeShaderBackground.classList.add('shader-mounted');
      updateHomeShaderPlayback();
    } catch {
      elements.homeShaderBackground.classList.add('shader-fallback');
    }
  }

  function updateHomeShaderPlayback() {
    if (!state.homeShaderMount || typeof state.homeShaderMount.setSpeed !== 'function') {
      return;
    }

    const shouldAnimate =
      state.activeView === 'landing' && !document.hidden && !prefersReducedMotion();
    state.homeShaderMount.setSpeed(shouldAnimate ? HOME_SHADER_SPEED : 0);
  }

  async function submitRequest(payload) {
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      return { success: true };
    } catch {
      return { success: false, error: 'SUBMISSION_FAILED' };
    }
  }

  function renderReceipt(request) {
    elements.receiptList.textContent = '';
    addReceiptItem('需求内容', request.content);

    if (request.name) {
      addReceiptItem('您的名字', request.name);
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

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatDeadlineDate(date) {
    return date.getMonth() + 1 + '月' + date.getDate() + '日';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
