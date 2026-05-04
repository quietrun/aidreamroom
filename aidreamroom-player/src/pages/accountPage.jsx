import { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../constant';
import { clearLogin } from '../function/loginCheck';
import { API } from '../utils/API';
import {
  commitUserInfo,
  ensureUserInfo,
  getCachedUserInfo,
} from '../utils/session';

const tabs = [
  { key: 'profile', label: '账号信息', icon: 'circle' },
  { key: 'settings', label: '基础设置', icon: 'gear' },
  { key: 'security', label: '安全与隐私', icon: 'hex' },
  { key: 'about', label: '关于', icon: 'diamond' },
];

function Icon({ name }) {
  const paths = {
    circle: <circle cx="12" cy="12" r="5.2" />,
    gear: (
      <>
        <circle cx="12" cy="12" r="2.4" />
        <path d="M12 5.4v1.5M12 17.1v1.5M5.4 12h1.5M17.1 12h1.5M7.3 7.3l1.1 1.1M15.6 15.6l1.1 1.1M16.7 7.3l-1.1 1.1M8.4 15.6l-1.1 1.1" />
      </>
    ),
    hex: <path d="M12 4.8l6.1 3.6v7.2L12 19.2l-6.1-3.6V8.4L12 4.8z" />,
    diamond: <path d="M12 4.7l7.3 7.3-7.3 7.3L4.7 12 12 4.7z" />,
    x: (
      <>
        <path d="M7.8 7.8l8.4 8.4" />
        <path d="M16.2 7.8l-8.4 8.4" />
      </>
    ),
    power: (
      <>
        <path d="M12 4.8v6.1" />
        <path d="M7.6 7.7a6.1 6.1 0 1 0 8.8 0" />
      </>
    ),
    card: <path d="M5.5 8h13v8h-13zM7.5 11h4.7M14.8 13.6h1.8" />,
    language: <path d="M5.5 18.2l4.1-12.4h1.2l4.1 12.4M7.1 14.1h6.2M14 7.3h4.5M16.3 5.6v1.7M15.1 7.3c.7 2.4 1.9 4.4 3.7 6M18.6 7.3c-.8 2.3-2.1 4.3-4 5.9" />,
    bell: <path d="M12 18.4a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8zM12 8.4v3.8l2.5 1.5" />,
    shield: <path d="M12 4.8l5.5 2.4v4.6c0 3.5-2.2 5.9-5.5 7.4-3.3-1.5-5.5-3.9-5.5-7.4V7.2L12 4.8z" />,
    clock: <path d="M12 18.6a6.6 6.6 0 1 0 0-13.2 6.6 6.6 0 0 0 0 13.2zM12 8.2V12l2.5 2" />,
    data: <path d="M7 7h10v10H7zM10 7v10M14 7v10" />,
    document: <path d="M7.5 5.8h7l2 2v10.4h-9zM14.5 5.8v2h2M9.5 11h5M9.5 14h5" />,
    mail: <path d="M6.3 7.5h11.4v9H6.3zM6.8 8l5.2 4.3L17.2 8" />,
    sparkle: <path d="M12 4.8l1.5 4.3 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3-4.3-1.5 4.3-1.5z" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.circle}
    </svg>
  );
}

function Pill({ children, tone = 'gold' }) {
  return <span className={`account-page__pill is-${tone}`}>{children}</span>;
}

function HeaderButton({ children, onClick, tone = 'neutral', className = '' }) {
  return (
    <button type="button" className={`account-page__headerbutton is-${tone}${className ? ` ${className}` : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="account-page__sectiontitle">
      <i />
      <span>{children}</span>
    </div>
  );
}

function InfoCard({ label, value, wide, children }) {
  return (
    <div className={`account-page__infocard${wide ? ' is-wide' : ''}`}>
      <span>{label}</span>
      <strong>{children || value || '--'}</strong>
    </div>
  );
}

function MenuRow({ icon, title, description, suffix, danger, onClick }) {
  return (
    <button type="button" className={`account-page__menurow${danger ? ' is-danger' : ''}`} onClick={onClick}>
      <i>
        <Icon name={icon} />
      </i>
      <span>
        <strong>{title}</strong>
        <em>{description}</em>
      </span>
      {suffix ? <b>{suffix}</b> : null}
      <small>›</small>
    </button>
  );
}

function NavItem({ item, active, onClick }) {
  return (
    <button type="button" className={`account-page__navitem${active ? ' is-active' : ''}`} onClick={onClick}>
      <i>
        <Icon name={item.icon} />
      </i>
      <span>{item.label}</span>
    </button>
  );
}

function EditRow({ label, children }) {
  return (
    <label className="account-edit-modal__field">
      <span>{label}</span>
      <div className="account-edit-modal__fieldbody">{children}</div>
    </label>
  );
}

function EditInput({ value, onChange, placeholder }) {
  return <input className="account-edit-modal__input" value={value} onChange={onChange} placeholder={placeholder} />;
}

function AccountEditTitle() {
  return (
    <div className="account-edit-modal__title">
      <span>ACCOUNT PROFILE</span>
      <strong id="account-edit-modal-title">修改账号信息</strong>
    </div>
  );
}

export function AccountPage() {
  const navigate = useNavigate();
  const cachedUserInfo = getCachedUserInfo();
  const [loading, setLoading] = useState(!cachedUserInfo);
  const [activeTab, setActiveTab] = useState('profile');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState(cachedUserInfo || {});
  const [form, setForm] = useState({
    user_name: cachedUserInfo?.user_name || '',
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const nextUserInfo = await ensureUserInfo();
        if (!mounted) {
          return;
        }

        const next = nextUserInfo || {};
        setUserInfo(next);
        setForm({
          user_name: next.user_name || '',
        });
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('账号信息加载失败');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const activeTitle = useMemo(() => tabs.find((item) => item.key === activeTab)?.label || '账号信息', [activeTab]);

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const logout = () => {
    Modal.confirm({
      title: '确认注销账号？',
      content: '注销后会返回登录页，本机保存的登录状态会被清除。',
      okText: '确认注销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk() {
        clearLogin({ clearStorage: true });
        navigate('/login', { replace: true });
      },
    });
  };

  const saveInfo = async () => {
    if (!form.user_name.trim()) {
      message.info('用户名不能为空');
      return;
    }

    try {
      setSaving(true);
      const result = await API.USER_UPDATE_INFO({ user_name: form.user_name.trim() });
      if (result?.status !== 0) {
        message.error(result?.message || '账号信息保存失败');
        return;
      }

      const latest = await ensureUserInfo({ force: true });
      commitUserInfo(latest);
      setUserInfo(latest || {});
      setEditing(false);
      message.success('账号信息已更新');
    } catch (error) {
      console.error(error);
      message.error('账号信息保存失败');
    } finally {
      setSaving(false);
    }
  };

  const openProfileEditor = () => {
    setActiveTab('profile');
    setEditing(true);
  };

  const renderContent = () => {
    if (activeTab === 'settings') {
      return (
        <>
          <SectionTitle>账号操作</SectionTitle>
          <div className="account-page__menupanel">
            <MenuRow icon="card" title="修改账号信息" description="编辑用户名" onClick={openProfileEditor} />
            <MenuRow icon="language" title="界面语言" description="当前：简体中文" suffix="简体中文" onClick={() => message.info('当前仅支持简体中文')} />
            <MenuRow icon="bell" title="消息通知" description="管理邮件与系统通知偏好" onClick={() => message.info('消息通知设置暂未开放')} />
          </div>

          <SectionTitle>危险操作</SectionTitle>
          <div className="account-page__dangerpanel">
            <span>
              <strong>注销账号</strong>
              <em>清除本机登录状态，返回登录页面。本地保存的所有会话数据将被删除。</em>
            </span>
            <button type="button" onClick={logout}>立即注销</button>
          </div>
        </>
      );
    }

    if (activeTab === 'security') {
      return (
        <>
          <SectionTitle>登录安全</SectionTitle>
          <div className="account-page__menupanel">
            <MenuRow icon="shield" title="修改密码" description="定期更换密码以保护账号安全" onClick={() => message.info('密码修改暂未开放')} />
            <MenuRow icon="clock" title="登录记录" description="查看近期设备登录历史" onClick={() => message.info('登录记录暂未开放')} />
          </div>

          <SectionTitle>隐私设置</SectionTitle>
          <div className="account-page__menupanel">
            <MenuRow icon="data" title="数据管理" description="导出或删除您的账号数据" onClick={() => message.info('数据管理暂未开放')} />
          </div>
        </>
      );
    }

    if (activeTab === 'about') {
      return (
        <>
          <SectionTitle>应用信息</SectionTitle>
          <div className="account-page__aboutcard">
            <span>
              <strong>AI Dreamroom</strong>
              <em>Beta 1.0.0 · Build 20260504</em>
            </span>
            <Pill>最新版本</Pill>
          </div>

          <SectionTitle>更多信息</SectionTitle>
          <div className="account-page__menupanel">
            <MenuRow icon="document" title="用户协议" description="查看服务条款与用户协议" onClick={() => message.info('用户协议暂未开放')} />
            <MenuRow icon="mail" title="隐私政策" description="了解我们如何处理您的数据" onClick={() => message.info('隐私政策暂未开放')} />
            <MenuRow icon="sparkle" title="问题反馈" description="报告问题或提出功能建议" onClick={() => message.info('问题反馈暂未开放')} />
          </div>
        </>
      );
    }

    return (
      <>
        <SectionTitle>基本信息</SectionTitle>
        <div className="account-page__infogrid">
          <InfoCard label="用户名" value={userInfo.user_name} />
          <InfoCard label="用户 ID" value={userInfo.user_id} />
          <InfoCard label="邮箱地址" value={userInfo.user_email} />
          <InfoCard label="手机号码" value={userInfo.user_phone} />
          <InfoCard label="注册时间" value={userInfo.created_at || userInfo.register_time || '2026-03-12'} />
          <InfoCard label="最近登录" value={userInfo.last_login || '2026-05-04'} />
          <InfoCard label="账号状态" wide>
            正常 <Pill tone="green">已验证</Pill>
          </InfoCard>
        </div>

        <button type="button" className="account-page__primaryaction" onClick={openProfileEditor}>编辑账号信息</button>

        {editing ? (
          <div className="account-page__inlineeditor" role="dialog" aria-modal="false" aria-labelledby="account-edit-modal-title">
            <button type="button" className="account-edit-modal__close" onClick={() => setEditing(false)} disabled={saving} aria-label="关闭">
              ×
            </button>
            <AccountEditTitle />
            <div className="account-edit-modal__form">
              <EditRow label="用户名">
                <EditInput value={form.user_name} onChange={(event) => updateField('user_name', event.target.value)} placeholder="请输入用户名" />
              </EditRow>
            </div>
            <div className="account-edit-modal__actions">
              <button type="button" className="account-edit-modal__cancel" onClick={() => setEditing(false)} disabled={saving}>
                取消
              </button>
              <button type="button" className="account-edit-modal__save" onClick={saveInfo} disabled={saving}>
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  if (loading) {
    return (
      <div className="main-container account-page">
        <div className="account-page__loading">
          <Spin />
        </div>
      </div>
    );
  }

  return (
    <div className="main-container account-page">
      <img alt="logo" className="login-logo account-page__logo" src={images.logo} />
      <div className="account-page__shell">
        <aside className="account-page__sidebar">
          <section className="account-page__profilecard">
            <img alt="avatar" className="account-page__avatar" src={images.avater} />
            <i className="account-page__online" />
            <h1>{userInfo.user_name || '梦境访客'}</h1>
            <p>{userInfo.user_id || '--'}</p>
            <div className="account-page__badges">
              <Pill tone="green">已登录</Pill>
              <Pill>Beta</Pill>
            </div>
            <dl>
              <dt>邮箱</dt>
              <dd>{userInfo.user_email || '--'}</dd>
              <dt>手机</dt>
              <dd>{userInfo.user_phone || '--'}</dd>
              <dt>注册时间</dt>
              <dd>{userInfo.created_at || userInfo.register_time || '2026-03-12'}</dd>
              <dt>最近登录</dt>
              <dd>{userInfo.last_login || '2026-05-04'}</dd>
            </dl>
          </section>

          <nav className="account-page__nav">
            <span>导航</span>
            {tabs.map((item) => (
              <NavItem key={item.key} item={item} active={item.key === activeTab} onClick={() => setActiveTab(item.key)} />
            ))}
            <div className="account-page__navspacer" />
            <button type="button" className="account-page__navitem" onClick={() => navigate('/mepage')}>
              <i><Icon name="x" /></i>
              <span>我的角色</span>
            </button>
            <button type="button" className="account-page__navitem is-logout" onClick={logout}>
              <i><Icon name="power" /></i>
              <span>注销账号</span>
            </button>
          </nav>
        </aside>

        <main className="account-page__main">
          <header className="account-page__header">
            <div>
              <strong>{activeTitle}</strong>
            </div>
            <menu>
              <HeaderButton tone="gold" onClick={() => navigate('/mepage')}>我的角色</HeaderButton>
              <HeaderButton className="desktop-return-home-button" onClick={() => navigate('/main')}>
                {/* <span>‹</span> */}
                返回主页
              </HeaderButton>
            </menu>
          </header>
          <div className="account-page__content">{renderContent()}</div>
        </main>
      </div>
      <img alt="eng-logo" className="login-eng-logo account-page__englogo" src={images.eng_logo} />
    </div>
  );
}
