import { useEffect, useState } from 'react';
import { Input, Modal, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import { clearLogin } from '../../function/loginCheck';
import { API } from '../../utils/API';
import { commitUserInfo, ensureUserInfo, getCachedUserInfo } from '../../utils/session';

const cardStyle = {
  width: '16.8rem',
  background: 'rgba(0, 0, 0, 0.28)',
  border: '0.044rem solid rgba(255,255,255,0.08)',
  borderRadius: '0.875rem',
  padding: '0.875rem',
  color: '#fff',
  boxSizing: 'border-box',
};

function ActionButton({ label, onClick, danger = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.5rem 0.8rem',
        color: '#fff',
        background: danger ? 'rgba(142, 38, 32, 0.86)' : 'rgba(28, 122, 59, 0.85)',
        border: '0.044rem solid rgba(255,255,255,0.12)',
        fontSize: '0.62rem',
      }}
    >
      {label}
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.42rem 0', borderBottom: '0.044rem solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ color: '#fff', textAlign: 'right', wordBreak: 'break-all' }}>{value || '--'}</span>
    </div>
  );
}

function SettingRow({ title, description, onClick, danger = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        minHeight: '2.65rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        padding: '0.5rem 0',
        borderBottom: '0.044rem solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
      }}
    >
      <div style={{ minWidth: 0, textAlign: 'left' }}>
        <div style={{ color: danger ? '#ffb4aa' : '#fff', fontSize: '0.62rem' }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: '0.5rem', marginTop: '0.18rem' }}>{description}</div>
      </div>
      <img alt="entry" src={images.icon_start} style={{ width: '0.72rem', height: '0.72rem', opacity: 0.72, transform: 'rotate(180deg)' }} />
    </div>
  );
}

function EditRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0', borderBottom: '0.044rem solid rgba(255,255,255,0.08)' }}>
      <div style={{ width: '3.4rem', color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export function MobileAccountPage() {
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
        navigate('/mobile/login', { replace: true });
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
      <div className="mobile-app">
        <div className="main-container">
          <div className="mainpage-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Spin />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mainpage-container">
          <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '0.75rem 0.6rem 1.2rem', boxSizing: 'border-box' }}>
            <div className="normal-row" style={{ marginBottom: '0.75rem' }}>
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate('/mobile/main')} />
              </div>
              <span style={{ fontSize: '0.86rem' }}>{'账号管理'}</span>
              <ActionButton label="角色" onClick={() => navigate('/mobile/mepage')} />
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'账号信息'}</div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.56rem', textAlign: 'left' }}>
                <InfoLine label="用户名" value={userInfo.user_name} />
                <InfoLine label="用户 ID" value={userInfo.user_id} />
                <InfoLine label="邮箱" value={userInfo.user_email} />
                <InfoLine label="手机" value={userInfo.user_phone} />
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'基础功能'}</div>
              <div>
                <SettingRow title="修改账号信息" description="编辑用户名、邮箱和手机号" onClick={() => setEditing(true)} />
                <SettingRow title="关于" description="查看当前版本信息" onClick={() => Modal.info({ title: '关于', content: 'AI Dreamroom Beta 0.9.2' })} />
                <SettingRow title="注销账号" description="清除本机登录状态并返回登录页" onClick={logout} danger />
              </div>
            </div>
          </div>
        </div>

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
              <Input value={form.user_name} onChange={(event) => updateField('user_name', event.target.value)} placeholder="用户名" />
            </EditRow>
            <EditRow label="邮箱">
              <Input value={form.user_email} onChange={(event) => updateField('user_email', event.target.value)} placeholder="邮箱" />
            </EditRow>
            <EditRow label="手机">
              <Input value={form.user_phone} onChange={(event) => updateField('user_phone', event.target.value)} placeholder="手机" />
            </EditRow>
          </div>
        </Modal>
      </div>
    </div>
  );
}
