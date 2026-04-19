import { useEffect, useState } from 'react';
import { Input, Modal, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../constant';
import { clearLogin } from '../function/loginCheck';
import { API } from '../utils/API';
import { commitUserInfo, ensureUserInfo, getCachedUserInfo } from '../utils/session';

const panelStyle = {
  background: 'rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '1rem',
  color: '#fff',
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  borderColor: 'rgba(255,255,255,0.12)',
  color: '#fff',
};

function ActionButton({ label, onClick, danger = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.65rem 1.2rem',
        color: '#fff',
        background: danger ? 'rgba(142, 38, 32, 0.86)' : 'rgba(28, 122, 59, 0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.9rem',
      }}
    >
      {label}
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.58)' }}>{label}</span>
      <span style={{ color: '#fff', textAlign: 'right', wordBreak: 'break-all' }}>{value || '--'}</span>
    </div>
  );
}

function SettingRow({ title, description, onClick, danger = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        minHeight: '3.4rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.85rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
      }}
    >
      <div style={{ minWidth: 0, textAlign: 'left' }}>
        <div style={{ color: danger ? '#ffb4aa' : '#fff', fontSize: '0.95rem' }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{description}</div>
      </div>
      <img alt="entry" src={images.icon_start} style={{ width: '1rem', height: '1rem', opacity: 0.72, transform: 'rotate(180deg)' }} />
    </div>
  );
}

function EditRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ width: '5rem', color: 'rgba(255,255,255,0.62)', fontSize: '0.86rem' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export function AccountPage() {
  const navigate = useNavigate();
  const cachedUserInfo = getCachedUserInfo();
  const [loading, setLoading] = useState(!cachedUserInfo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState(cachedUserInfo || {});
  const [form, setForm] = useState({
    user_name: cachedUserInfo?.user_name || '',
    user_email: cachedUserInfo?.user_email || '',
    user_phone: cachedUserInfo?.user_phone || '',
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
          user_email: next.user_email || '',
          user_phone: next.user_phone || '',
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
      const result = await API.USER_UPDATE_INFO(form);
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

  if (loading) {
    return (
      <div className="main-container">
        <img alt="logo" className="login-logo" src={images.logo} />
        <div className="mainpage-container" style={{ width: '26rem', height: '14rem', justifyContent: 'center' }}>
          <Spin />
        </div>
        <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
      </div>
    );
  }

  return (
    <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <img alt="logo" className="login-logo" src={images.logo} />
      <div className="mainpage-container" style={{ width: '42rem', minHeight: '34rem', backgroundImage: 'none', backgroundColor: 'rgba(35, 38, 40, 0.92)', padding: '1.5rem 1.8rem' }}>
        <div className="normal-row" style={{ marginBottom: '1rem' }}>
          <div className="row">
            <img alt="back" src={images.icon_back} onClick={() => navigate('/main')} title="返回主页" />
            <span style={{ fontSize: '1.35rem' }}>{'账号管理'}</span>
          </div>
          <ActionButton label="我的角色" onClick={() => navigate('/mepage')} />
        </div>

        <div style={{ ...panelStyle, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ color: '#fff', fontSize: '1.05rem', textAlign: 'left', marginBottom: '0.8rem' }}>{'账号信息'}</div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.9rem', textAlign: 'left' }}>
            <InfoLine label="用户名" value={userInfo.user_name} />
            <InfoLine label="用户 ID" value={userInfo.user_id} />
            <InfoLine label="邮箱" value={userInfo.user_email} />
            <InfoLine label="手机" value={userInfo.user_phone} />
          </div>
        </div>

        <div style={{ ...panelStyle, width: '100%', boxSizing: 'border-box', marginTop: '1rem' }}>
          <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.9rem' }}>{'基础功能'}</div>
          <div>
            <SettingRow title="修改账号信息" description="编辑用户名、邮箱和手机号" onClick={() => setEditing(true)} />
            <SettingRow title="关于" description="查看当前版本信息" onClick={() => Modal.info({ title: '关于', content: 'AI Dreamroom Beta 0.9.2' })} />
            <SettingRow title="注销账号" description="清除本机登录状态并返回登录页" onClick={logout} danger />
          </div>
        </div>
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />

      <Modal
        title="修改账号信息"
        open={editing}
        okText={saving ? '保存中...' : '保存'}
        cancelText="取消"
        onOk={saveInfo}
        onCancel={() => setEditing(false)}
        confirmLoading={saving}
      >
        <div style={{ marginTop: '0.5rem' }}>
          <EditRow label="用户名">
            <Input value={form.user_name} onChange={(event) => updateField('user_name', event.target.value)} placeholder="用户名" style={inputStyle} />
          </EditRow>
          <EditRow label="邮箱">
            <Input value={form.user_email} onChange={(event) => updateField('user_email', event.target.value)} placeholder="邮箱" style={inputStyle} />
          </EditRow>
          <EditRow label="手机">
            <Input value={form.user_phone} onChange={(event) => updateField('user_phone', event.target.value)} placeholder="手机" style={inputStyle} />
          </EditRow>
        </div>
      </Modal>
    </div>
  );
}
