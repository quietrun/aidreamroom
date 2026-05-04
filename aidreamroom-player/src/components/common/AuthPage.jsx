import { useState } from 'react';
import { Checkbox, Input, message, Spin } from 'antd';
import md5 from 'js-md5';
import { useNavigate } from 'react-router-dom';

import { images, ErrorMessage } from '../../constant';
import { API } from '../../utils/API';
import { commitLoginSession } from '../../utils/session';
import iconWaiting from '@/icon_waiting.png';

function MobileModeButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`mobile-auth-page__modebutton${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MobileSegmentButton({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      className={`mobile-auth-page__segmentbutton${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <img alt="" src={icon} />
      <span>{label}</span>
    </button>
  );
}

function MobileField({ label, trailing = null, children }) {
  return (
    <div className="mobile-auth-page__field">
      <div className="mobile-auth-page__fieldhead">
        <span>{label}</span>
      </div>
      <div className="mobile-auth-page__fieldbody">
        {children}
        {trailing}
      </div>
    </div>
  );
}

function MobileToggleRow({ label, description, checked, onToggle }) {
  return (
    <button
      type="button"
      className={`mobile-auth-page__togglerow${checked ? ' is-checked' : ''}`}
      onClick={onToggle}
    >
      <span className="mobile-auth-page__togglemark">{checked ? '✓' : ''}</span>
      <span className="mobile-auth-page__togglecopy">
        <strong>{label}</strong>
        {description ? <em>{description}</em> : null}
      </span>
    </button>
  );
}

function PcModeButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`pc-auth-page__modebutton${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function PcSegmentButton({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      className={`pc-auth-page__segmentbutton${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <img alt="" src={icon} />
      <span>{label}</span>
    </button>
  );
}

function PcField({ label, trailing = null, children }) {
  return (
    <div className="pc-auth-page__field">
      <span>{label}</span>
      <div className="pc-auth-page__fieldbody">
        {children}
        {trailing}
      </div>
    </div>
  );
}

function PcCheckRow({ label, checked, onChange, action = null }) {
  return (
    <div className="pc-auth-page__checkrow">
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
      {action}
    </div>
  );
}

export function AuthPage({ mobile = false }) {
  const navigate = useNavigate();
  const [recordUser, setRecordUser] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [isForget, setIsForget] = useState(false);
  const [isAgree, setIsAgree] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [startCount, setStartCount] = useState(false);
  const [countTime, setCountTime] = useState(60);
  const [accountType, setAccountType] = useState(1);
  const [showRegisterList, setShowRegisterList] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const startCodeCount = () => {
    setStartCount(true);
    setCountTime(60);
    const timer = window.setInterval(() => {
      setCountTime((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setStartCount(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const openMainPage = () => {
    if (mobile && showRegisterList) {
      setShowRegisterList(false);
      setIsRegister(true);
      setIsForget(false);
      return;
    }
    window.open('https://www.infinityplanet.world/', '_self');
  };

  const startRegister = () => {
    window.setTimeout(() => {
      setIsRegister((current) => !current);
      setIsForget(false);
    }, 100);
  };

  const startForget = () => {
    window.setTimeout(() => {
      setIsForget((current) => !current);
      setIsRegister(false);
    }, 100);
  };

  const login = async () => {
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    try {
      const response = await API.EMAIL_LOGIN({
        email,
        password: md5(password),
        recordUser,
      });
      const { token, result, msgId } = response;
      if (result !== 0) {
        message.error(ErrorMessage[msgId]);
        return;
      }
      commitLoginSession(token);
      navigate(mobile ? '/mobile/main' : '/main', { replace: true });
    } catch (error) {
      console.error(error);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const register = async () => {
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    try {
      const response = await API.EMAIL_REGISTER({
        email,
        code: emailCode,
        password: md5(password),
        accountType,
      });
      const { token, result, msgId } = response;
      if (result !== 0) {
        message.error(ErrorMessage[msgId]);
        return;
      }
      commitLoginSession(token);
      navigate(mobile ? '/mobile/main' : '/main', { replace: true });
    } catch (error) {
      console.error(error);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    try {
      const response = await API.EMAIL_EDIT_PASSWORD({
        email,
        code: emailCode,
        password: md5(password),
      });
      const { token, result, msgId } = response;
      if (result !== 0) {
        message.error(ErrorMessage[msgId]);
        return;
      }
      commitLoginSession(token);
      navigate(mobile ? '/mobile/main' : '/main', { replace: true });
    } catch (error) {
      console.error(error);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const joinWaitingList = async () => {
    if (authSubmitting) {
      return;
    }
    if (!isAgree) {
      message.warning('请勾选上方提示后继续');
      return;
    }
    setAuthSubmitting(true);
    try {
      const { result } = await API.USER_apply_reigset({ account: email });
      if (result === 0) {
        message.info('成功加入队列，在您的账号可以注册时会以短信验证码或短信的方式进行通知');
        return;
      }
      message.info('您的账号还在排队等待中，请耐心等待注册名额开放。');
    } catch (error) {
      console.error(error);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const getEmailCode = async () => {
    startCodeCount();
    if (isRegister) {
      const { result } = await API.USER_CHECK_IN_REGISTERLIST({
        account: email.toString(),
      });
      if (result === 0) {
        setShowRegisterList(true);
        return;
      }
    }
    const response = await API.EMIL_GET_CODE({
      email: email.toString(),
      type: isRegister ? 0 : 1,
      accountType,
    });
    const { result, msgId } = response;
    if (result !== 0) {
      message.error(ErrorMessage[msgId]);
      setCountTime(0);
    }
  };

  const submit = () => {
    if (authSubmitting) {
      return;
    }
    if (isRegister) {
      if (!isAgree) {
        message.warning('请同意《用户使用协议》');
        return;
      }
      if (password !== passwordAgain) {
        message.warning('两次密码不同');
        return;
      }
      register();
      return;
    }
    if (isForget) {
      if (password !== passwordAgain) {
        message.warning('两次密码不同');
        return;
      }
      resetPassword();
      return;
    }
    if (!isAgree) {
      message.warning('请同意《用户使用协议》');
      return;
    }
    login();
  };

  const submitDisabled = authSubmitting || (showRegisterList ? !isAgree : !isForget && !isAgree);

  if (mobile) {
    const mobileMode = showRegisterList
      ? 'waiting'
      : isForget
        ? 'forget'
        : isRegister
          ? 'register'
          : 'login';
    const title = showRegisterList
      ? '加入等待队列'
      : isForget
        ? '找回密码'
        : isRegister
          ? '创建账号'
          : '欢迎回来';
    const subtitle = showRegisterList
      ? '名额开放后第一时间通知你。'
      : isForget
        ? '通过验证码重设密码。'
        : isRegister
          ? '创建账号，进入 AI 梦之家。'
          : '继续你的梦境旅程。';
    const actionLabel = showRegisterList
      ? '加入等待队列'
      : isRegister
        ? '立即注册'
        : isForget
          ? '重置密码'
          : '立即登录';

    return (
      <div className="mobile-app">
        <div className={`main-container mobile-auth-page mobile-auth-page--${mobileMode}`}>
          <div className="mobile-auth-page__statusbar" aria-hidden="true">
            <span>9:41</span>
            <div className="mobile-auth-page__statusicons">
              <i />
              <i />
              <i />
            </div>
          </div>

          <header className="mobile-auth-page__brand">
            <span>AI DREAMROOM</span>
            <strong>梦之家</strong>
          </header>

          {showRegisterList ? (
            <img alt="艾达" className="mobile-auth-page__waiting-woman" src={images.aidr_women} />
          ) : null}

          <section className="mobile-auth-page__sheet">
            <div className="mobile-auth-page__handle" aria-hidden="true" />

            {!showRegisterList ? (
              <div className="mobile-auth-page__modegroup">
                <MobileModeButton
                  label="登录"
                  active={!isRegister && !isForget}
                  onClick={() => {
                    setShowRegisterList(false);
                    setIsRegister(false);
                    setIsForget(false);
                  }}
                />
                <MobileModeButton
                  label="注册"
                  active={isRegister}
                  onClick={() => {
                    setShowRegisterList(false);
                    setIsRegister(true);
                    setIsForget(false);
                  }}
                />
                <MobileModeButton
                  label="找回"
                  active={isForget}
                  onClick={() => {
                    setShowRegisterList(false);
                    setIsForget(true);
                    setIsRegister(false);
                  }}
                />
              </div>
            ) : null}

            <div className="mobile-auth-page__intro">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            {!showRegisterList ? (
              <>
                <div className="mobile-auth-page__segmentgroup">
                  <MobileSegmentButton
                    label="手机号码"
                    icon={
                      accountType !== 1
                        ? images.icon_phone_select
                        : images.icon_phone_selected
                    }
                    active={accountType === 1}
                    onClick={() => setAccountType(1)}
                  />
                  <MobileSegmentButton
                    label="电子邮箱"
                    icon={
                      accountType !== 0
                        ? images.icon_email_select
                        : images.icon_email_selected
                    }
                    active={accountType === 0}
                    onClick={() => setAccountType(0)}
                  />
                </div>

                <div className="mobile-auth-page__fieldgroup">
                  <MobileField
                    label={accountType === 1 ? '手机号码' : '电子邮箱'}
                    trailing={
                      isForget || isRegister ? (
                        <button
                          type="button"
                          className={`mobile-auth-page__codebutton${startCount ? ' is-counting' : ''}`}
                          onClick={getEmailCode}
                        >
                          {startCount ? `${countTime}s` : '获取验证码'}
                        </button>
                      ) : null
                    }
                  >
                    <Input
                      bordered={false}
                      className="mobile-auth-page__inputcontrol"
                      placeholder={accountType === 1 ? '请输入手机号码' : '请输入电子邮箱'}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </MobileField>

                  {isForget || isRegister ? (
                    <MobileField label={accountType === 1 ? '验证码' : '邮箱验证码'}>
                      <Input
                        bordered={false}
                        className="mobile-auth-page__inputcontrol"
                        placeholder="请输入验证码"
                        value={emailCode}
                        onChange={(event) => setEmailCode(event.target.value)}
                      />
                    </MobileField>
                  ) : null}

                  <MobileField label={isForget ? '新密码' : '登录密码'}>
                    <Input.Password
                      bordered={false}
                      className="mobile-auth-page__inputcontrol"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </MobileField>

                  {isForget || isRegister ? (
                    <MobileField label="确认密码">
                      <Input.Password
                        bordered={false}
                        className="mobile-auth-page__inputcontrol"
                        placeholder="请再次输入密码"
                        value={passwordAgain}
                        onChange={(event) => setPasswordAgain(event.target.value)}
                      />
                    </MobileField>
                  ) : null}
                </div>

                {!isForget && !isRegister ? (
                  <MobileToggleRow
                    label="15 天内自动登录"
                    checked={recordUser}
                    onToggle={() => setRecordUser((current) => !current)}
                  />
                ) : null}

                {!isForget ? (
                  <MobileToggleRow
                    label={isRegister ? '注册即同意《用户使用协议》' : '登录即同意《用户使用协议》'}
                    checked={isAgree}
                    onToggle={() => setIsAgree((current) => !current)}
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className="mobile-auth-page__fieldgroup">
                  <MobileField label="手机号码 / 电子邮箱">
                    <Input
                      bordered={false}
                      className="mobile-auth-page__inputcontrol"
                      placeholder="请输入可接收通知的联系方式"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </MobileField>
                </div>

                <MobileToggleRow
                  label="同意加入队列，开放后通知我"
                  checked={isAgree}
                  onToggle={() => setIsAgree((current) => !current)}
                />
              </>
            )}

            <button
              type="button"
              className={`mobile-auth-page__submitbutton${showRegisterList ? ' is-waiting' : ''}${authSubmitting ? ' is-loading' : ''}`}
              onClick={showRegisterList ? joinWaitingList : submit}
              disabled={submitDisabled}
            >
              {authSubmitting ? <Spin size="small" /> : null}
              <span>{authSubmitting ? '处理中' : actionLabel}</span>
              {!authSubmitting && !showRegisterList ? <span aria-hidden="true">→</span> : null}
            </button>

            {!showRegisterList && !isRegister && !isForget ? (
              <>
                <div className="mobile-auth-page__divider"><span>或</span></div>
                <button type="button" className="mobile-auth-page__wechatbutton">
                  <img alt="" src={images.wx_login} />
                  <span>微信快捷登录</span>
                </button>
              </>
            ) : null}

            <p className="mobile-auth-page__terms">
              继续即代表您已阅读并接受 <button type="button">隐私政策</button> 及 <button type="button">服务条款</button>
            </p>
          </section>
        </div>
      </div>
    );
  }

  const pcModeLabel = showRegisterList
    ? 'WAITING QUEUE'
    : isForget
      ? 'RESET PASSWORD'
      : isRegister
        ? 'CREATE ACCOUNT'
        : 'SIGN IN';
  const pcTitle = showRegisterList
    ? '加入等待队列'
    : isForget
      ? '找回密码'
      : isRegister
        ? '创建账号'
        : '欢迎回来';
  const pcActionLabel = showRegisterList
    ? '加入等待队列'
    : isForget
      ? '重置密码'
      : isRegister
        ? '立即注册'
        : '立即登录';

  const resetMode = (nextMode) => {
    setShowRegisterList(false);
    setIsRegister(nextMode === 'register');
    setIsForget(nextMode === 'forget');
  };

  return (
    <div className="main-container pc-auth-page">
      <section className="pc-auth-page__brandpane">
        <p className="pc-auth-page__eyebrow">AI DREAMROOM · 梦之家</p>
        <h1>踏入你的<br />专属梦境</h1>
        <p className="pc-auth-page__copy">
          由 AI 驱动的沉浸式角色扮演世界，每一次对话都是独一无二的冒险。
        </p>
        <div className="pc-auth-page__mascot">
          <img alt="AIDR" className="pc-auth-page__aidrmark" src={images.AIDR} />
          <img alt="艾达" className="pc-auth-page__woman" src={images.aidr_women} />
        </div>
        <p className="pc-auth-page__caption">AI-POWERED INTERACTIVE ROLEPLAY</p>
      </section>

      <section className={`pc-auth-page__panel${showRegisterList ? ' is-waiting' : ''}`}>
        {!showRegisterList ? (
          <div className="pc-auth-page__modegroup">
            <PcModeButton label="登录" active={!isRegister && !isForget} onClick={() => resetMode('login')} />
            <PcModeButton label="注册" active={isRegister} onClick={() => resetMode('register')} />
            <PcModeButton label="找回密码" active={isForget} onClick={() => resetMode('forget')} />
          </div>
        ) : null}

        <p className="pc-auth-page__panel-eyebrow">{pcModeLabel}</p>
        <h2>{pcTitle}</h2>

        {!showRegisterList ? (
          <>
            <div className="pc-auth-page__segmentgroup">
              <PcSegmentButton
                label="手机号码"
                icon={accountType === 1 ? images.icon_phone_selected : images.icon_phone_select}
                active={accountType === 1}
                onClick={() => setAccountType(1)}
              />
              <PcSegmentButton
                label="电子邮箱"
                icon={accountType === 0 ? images.icon_email_selected : images.icon_email_select}
                active={accountType === 0}
                onClick={() => setAccountType(0)}
              />
            </div>

            <div className="pc-auth-page__fieldgroup">
              <PcField
                label={accountType === 1 ? '手机号码' : '电子邮箱'}
                trailing={
                  isRegister || isForget ? (
                    <button
                      type="button"
                      className="pc-auth-page__codebutton"
                      onClick={getEmailCode}
                    >
                      {startCount ? `${countTime}s` : '获取验证码'}
                    </button>
                  ) : null
                }
              >
                <Input
                  bordered={false}
                  placeholder={accountType === 1 ? '请输入手机号码' : '请输入电子邮箱'}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </PcField>

              {(isRegister || isForget) ? (
                <PcField label={accountType === 1 ? '短信验证码' : '邮箱验证码'}>
                  <Input
                    bordered={false}
                    placeholder="请输入验证码"
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                  />
                </PcField>
              ) : null}

              <PcField label={isForget ? '新密码' : '登录密码'}>
                <Input.Password
                  bordered={false}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </PcField>

              {(isRegister || isForget) ? (
                <PcField label="确认密码">
                  <Input.Password
                    bordered={false}
                    placeholder="请再次输入密码"
                    value={passwordAgain}
                    onChange={(event) => setPasswordAgain(event.target.value)}
                  />
                </PcField>
              ) : null}
            </div>

            {!isRegister && !isForget ? (
              <PcCheckRow
                label="15 天内自动登录"
                checked={recordUser}
                onChange={setRecordUser}
                action={
                  <button type="button" onClick={() => resetMode('forget')}>
                    忘记密码?
                  </button>
                }
              />
            ) : null}

            {!isForget ? (
              <PcCheckRow
                label={isRegister ? '注册即同意《用户使用协议》' : '登录即同意《用户使用协议》'}
                checked={isAgree}
                onChange={setIsAgree}
              />
            ) : null}
          </>
        ) : (
          <>
            <div className="pc-auth-page__waitingnote">
              <img alt="" src={iconWaiting} />
              <span>当前注册名额较紧张</span>
            </div>
            <PcField label="手机号码 / 电子邮箱">
              <Input
                bordered={false}
                placeholder="请输入可接收通知的联系方式"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </PcField>
            <PcCheckRow
              label="同意加入等待队列，资格开放时通知我"
              checked={isAgree}
              onChange={setIsAgree}
            />
          </>
        )}

        <button
          type="button"
          className={`pc-auth-page__submit${showRegisterList ? ' is-waiting' : ''}${authSubmitting ? ' is-loading' : ''}`}
          onClick={showRegisterList ? joinWaitingList : submit}
          disabled={submitDisabled}
        >
          {authSubmitting ? <Spin size="small" /> : null}
          <span>{authSubmitting ? '处理中' : pcActionLabel}</span>
          {!authSubmitting ? <span aria-hidden="true">→</span> : null}
        </button>

        {!showRegisterList && !isRegister && !isForget ? (
          <>
            <div className="pc-auth-page__divider"><span>或</span></div>
            <button type="button" className="pc-auth-page__wechat">
              <img alt="" src={images.wx_login} />
              <span>微信快捷登录</span>
            </button>
          </>
        ) : null}

        <p className="pc-auth-page__terms">
          继续即代表您已阅读并接受 <button type="button">隐私政策</button> 及 <button type="button">服务条款</button>
        </p>

        {showRegisterList ? (
          <button
            type="button"
            className="pc-auth-page__backlink"
            onClick={() => resetMode('register')}
          >
            ← 返回注册
          </button>
        ) : null}
      </section>
    </div>
  );
}
