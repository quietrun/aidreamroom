import { useState } from 'react';
import { Checkbox, Input, message } from 'antd';
import md5 from 'js-md5';
import { useNavigate } from 'react-router-dom';

import { images, ErrorMessage } from '../../constant';
import { API } from '../../utils/API';
import { commitLoginSession } from '../../utils/session';
import { AidrIntroduction } from './AidrIntroduction';
import iconForgetForbidden from '@/icon_forget_forbidden.png';
import iconRegisterForbidden from '@/icon_register_forbidden.png';
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
        {trailing}
      </div>
      <div className="mobile-auth-page__fieldbody">{children}</div>
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
    }
  };

  const register = async () => {
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
    }
  };

  const resetPassword = async () => {
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
    }
  };

  const joinWaitingList = async () => {
    if (!isAgree) {
      message.warning('请勾选上方提示后继续');
      return;
    }
    const { result } = await API.USER_apply_reigset({ account: email });
    if (result === 0) {
      message.info('成功加入队列，在您的账号可以注册时会以短信验证码或短信的方式进行通知');
      return;
    }
    message.info('您的账号还在排队等待中，请耐心等待注册名额开放。');
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

  if (mobile) {
    const title = showRegisterList
      ? '加入等待队列'
      : isForget
        ? '找回密码'
        : isRegister
          ? '创建账号'
          : '欢迎回来';
    const subtitle = showRegisterList
      ? '当前注册名额较紧张，先登记联系方式，我们会按顺序通知。'
      : isForget
        ? '通过验证码重设密码，重新接回你的梦境档案。'
        : isRegister
          ? '创建你的专属账号，准备进入 AI 梦之屋。'
          : '输入账号信息，继续你的梦境旅程。';
    const actionLabel = showRegisterList
      ? '加入等待队列'
      : isRegister
        ? '立即注册'
        : isForget
          ? '重置密码'
          : '立即登录';

    return (
      <div className="mobile-app">
        <div className="main-container mobile-auth-page">
          <div className="mobile-auth-page__scroll">
            <header className="mobile-auth-page__header">
              <div className="mobile-auth-page__brand">
                <img alt="logo" className="mobile-auth-page__logo" src={images.logo} />
                <span>AI Dreamroom</span>
              </div>
            </header>

            <section className="mobile-auth-page__hero">
              <span className="mobile-auth-page__eyebrow">
                {showRegisterList
                  ? 'Waiting Queue'
                  : isRegister
                    ? 'Register'
                    : isForget
                      ? 'Reset Password'
                      : 'Login'}
              </span>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </section>

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
                  label="找回密码"
                  active={isForget}
                  onClick={() => {
                    setShowRegisterList(false);
                    setIsForget(true);
                    setIsRegister(false);
                  }}
                />
              </div>
            ) : null}

            <section className="mobile-auth-page__panel">
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
                        placeholder={
                          accountType === 1 ? '请输入手机号码' : '请输入电子邮箱'
                        }
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </MobileField>

                    {isForget || isRegister ? (
                      <MobileField
                        label={accountType === 1 ? '短信验证码' : '邮箱验证码'}
                      >
                        <Input
                          bordered={false}
                          className="mobile-auth-page__inputcontrol"
                          placeholder="请输入验证码"
                          value={emailCode}
                          onChange={(event) => setEmailCode(event.target.value)}
                        />
                      </MobileField>
                    ) : null}

                    <MobileField label="登录密码">
                      <Input.Password
                        bordered={false}
                        className="mobile-auth-page__inputcontrol"
                        placeholder="请输入密码"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </MobileField>

                    {isForget || isRegister ? (
                      <MobileField label="再次确认密码">
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
                      label="记住账号"
                      description="15 天内自动登录，适合常用设备。"
                      checked={recordUser}
                      onToggle={() => setRecordUser((current) => !current)}
                    />
                  ) : null}

                  {!isForget ? (
                    <MobileToggleRow
                      label={
                        isRegister
                          ? '注册即同意用户使用协议'
                          : '登录即同意用户使用协议'
                      }
                      description="继续即代表你已阅读并接受相关条款。"
                      checked={isAgree}
                      onToggle={() => setIsAgree((current) => !current)}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <div className="mobile-auth-page__waitingnote">
                    <img alt="waiting" src={iconWaiting} />
                    <div>
                      <strong>当前注册人数较多</strong>
                      <span>
                        留下你的手机或邮箱，注册资格开放后我们会第一时间通知你。
                      </span>
                    </div>
                  </div>

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
                    label="同意加入等待队列"
                    description="我们只会在资格开放时联系你，不会频繁打扰。"
                    checked={isAgree}
                    onToggle={() => setIsAgree((current) => !current)}
                  />

                  <button
                    type="button"
                    className="mobile-auth-page__secondarybutton"
                    onClick={() => {
                      setShowRegisterList(false);
                      setIsRegister(true);
                      setIsForget(false);
                    }}
                  >
                    返回注册页
                  </button>
                </>
              )}

              <button
                type="button"
                className="mobile-auth-page__submitbutton"
                onClick={showRegisterList ? joinWaitingList : submit}
              >
                {actionLabel}
              </button>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="main-container">
        <img alt="logo" className="login-logo" src={images.logo} />
        {!showRegisterList ? (
          <div className="login-container">
            <div className="normal-row" style={{ width: '23rem' }}>
              <div
                style={{ width: '7rem', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => {
                  setIsRegister(false);
                  setIsForget(false);
                }}
              >
                <img alt="back" src={images.icon_back} title="返回" onClick={openMainPage} />
              </div>
              <span
                style={{
                  fontSize: '1.1rem',
                  width: '7rem',
                  textAlign: 'center',
                }}
              >
                {isForget ? '忘记密码' : isRegister ? '注册' : '登录'}
              </span>
              <div style={{ width: '7rem', textAlign: 'right', cursor: 'pointer' }}>
                <img
                  alt="forget"
                  src={!isForget ? images.icon_forget_psw : images.icon_forget_psw_selected}
                  title="忘记密码"
                  onClick={startForget}
                />
                <img
                  alt="register"
                  src={!isRegister ? images.icon_register : images.icon_register_selected}
                  title="注册"
                  style={{ marginLeft: '0.8rem' }}
                  onClick={startRegister}
                />
              </div>
            </div>
            <div className="normal-row" style={{ width: '12.7rem', marginTop: '1.5rem' }}>
              <div
                style={{
                  width: '100%',
                  height: '2rem',
                  background: `url(${images.phone_bg})`,
                  backgroundPosition: 'center center',
                  backgroundSize: '12.7rem 2rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#fff',
                }}
              >
                <div
                  style={{
                    width: '50%',
                    height: '2rem',
                    background: accountType === 1 ? `url(${images.phone_left_bg})` : null,
                    backgroundSize: accountType === 1 ? '100% 100%' : null,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setAccountType(1)}
                >
                  <img
                    alt="phone"
                    src={
                      accountType !== 1
                        ? images.icon_phone_select
                        : images.icon_phone_selected
                    }
                    style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.2rem' }}
                  />
                  <span
                    style={{
                      color: accountType === 1 ? '#000' : '#fff',
                    }}
                  >
                    手机号码
                  </span>
                </div>
                <div
                  style={{
                    width: '50%',
                    height: '2rem',
                    background: accountType === 0 ? `url(${images.phone_right_bg})` : null,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: accountType === 0 ? '#000' : '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setAccountType(0)}
                >
                  <img
                    alt="email"
                    src={
                      accountType !== 0
                        ? images.icon_email_select
                        : images.icon_email_selected
                    }
                    style={{ width: '0.95rem', height: '0.8rem', marginRight: '0.3rem' }}
                  />
                  <span
                    style={{
                      color: accountType === 0 ? '#000' : '#fff',
                    }}
                  >
                    电子邮箱
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                flexDirection: 'column',
                display: 'flex',
                width: '100%',
                marginTop: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{accountType === 1 ? '手机号码' : '电子邮箱'}</span>
                  <Input
                    bordered={false}
                    placeholder={accountType === 1 ? '手机号码' : '电子邮箱'}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                {(isForget || isRegister) && (
                  <div>
                    {!startCount ? (
                      <img
                        alt="code"
                        src={images.icon_get_email_code}
                        style={{ width: '2.2rem' }}
                        onClick={getEmailCode}
                        title="发送验证码"
                      />
                    ) : (
                      <div
                        style={{
                          width: '2.2rem',
                          height: '2.2rem',
                          backgroundColor: '#fff',
                          borderRadius: '2.2rem',
                          justifyContent: 'center',
                          alignItems: 'center',
                          display: 'flex',
                        }}
                      >
                        <span style={{ color: '#000', fontWeight: 'bold' }}>
                          {countTime}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {(isForget || isRegister) && (
                <>
                  <span style={{ marginTop: '1rem' }}>
                    {accountType === 1 ? '输入手机验证码' : '输入邮箱验证码'}
                  </span>
                  <Input
                    bordered={false}
                    placeholder="验证码"
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                  />
                </>
              )}
              <span style={{ marginTop: '1.5rem' }}>输入密码</span>
              <Input.Password
                bordered={false}
                placeholder="输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {(isForget || isRegister) && (
                <>
                  <span style={{ marginTop: '1rem' }}>再次输入密码</span>
                  <Input.Password
                    bordered={false}
                    placeholder="输入密码"
                    value={passwordAgain}
                    onChange={(event) => setPasswordAgain(event.target.value)}
                  />
                </>
              )}
            </div>
            {!isForget && !isRegister && (
              <div
                style={{
                  flexDirection: 'row',
                  display: 'flex',
                  alignContent: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginTop: '1.5rem',
                }}
              >
                <span>记住账号 (15天内自动登录)</span>
                <Checkbox
                  checked={recordUser}
                  onChange={(event) => setRecordUser(event.target.checked)}
                />
              </div>
            )}
            {!isForget && !isRegister && (
              <div className="login-btn-group">
                <img alt="wechat" src={images.wx_login} />
              </div>
            )}
            {!isForget && (
              <div
                style={{
                  flexDirection: 'row',
                  display: 'flex',
                  alignContent: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginTop: '1.5rem',
                }}
              >
                <span>
                  {isRegister ? '注册 即同意《用户使用协议》' : '登录 即同意《用户使用协议》'}
                </span>
                <Checkbox
                  checked={isAgree}
                  onChange={(event) => setIsAgree(event.target.checked)}
                />
              </div>
            )}
            <div className="login_btn" onClick={submit}>
              <img alt="start" src={images.icon_start} />
              <div>
                <span>{isRegister ? '立即注册' : '立即登录'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="login-container" style={{ height: '13rem' }}>
            <div className="normal-row" style={{ width: '23rem' }}>
              <div style={{ width: '7rem', textAlign: 'left', cursor: 'pointer' }}>
                <img alt="back" src={images.icon_back} onClick={openMainPage} />
              </div>
              <span style={{ fontSize: '0.8rem', width: '7rem', textAlign: 'center' }}>
                登记加入等待队伍
              </span>
              <div style={{ width: '7rem', textAlign: 'right', cursor: 'pointer' }}>
                <img alt="forget-disabled" src={iconForgetForbidden} />
                <img
                  alt="register-disabled"
                  src={iconRegisterForbidden}
                  style={{ marginLeft: '0.8rem' }}
                />
              </div>
            </div>
            <div
              style={{
                flexDirection: 'column',
                display: 'flex',
                width: '100%',
                marginTop: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>手机号码/电子邮箱</span>
                  <Input
                    bordered={false}
                    placeholder="手机号码/电子邮箱"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                flexDirection: 'row',
                display: 'flex',
                alignContent: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginTop: '1.5rem',
              }}
            >
              <span>
                由于当前注册人数过多，请登记加入等待队伍，AI梦之家 按照 “登记顺序”
                通知等待中的用户。
              </span>
              <Checkbox
                checked={isAgree}
                onChange={(event) => setIsAgree(event.target.checked)}
              />
            </div>
            <div
              className="login_btn"
              onClick={joinWaitingList}
              style={{ background: 'rgba(8, 134, 0, 0.49)', top: '12rem' }}
            >
              <img alt="waiting" src={iconWaiting} />
              <div style={{ background: 'rgba(21,111,21, 1)' }}>
                <span>加入等待</span>
              </div>
            </div>
          </div>
        )}
        <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
        <AidrIntroduction />
      </div>
    </div>
  );
}
