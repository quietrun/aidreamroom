import { useEffect, useState } from 'react';
import { Input, Modal, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import { clearLogin } from '../../function/loginCheck';
import { API } from '../../utils/API';
import { commitUserInfo, ensureUserInfo, getCachedUserInfo } from '../../utils/session';

function EditRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0', borderBottom: '0.044rem solid rgba(255,255,255,0.08)' }}>
      <div style={{ width: '3.4rem', color: '#000000', fontSize: '0.72rem' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function MobileHeaderAction({ label, onClick }) {
  return (
    <button type="button" className="mobile-account-page__rolebutton" onClick={onClick}>
      {label}
    </button>
  );
}

function AccountDetailItem({ label, value }) {
  return (
    <div className="mobile-account-page__detailitem">
      <span>{label}</span>
      <strong>{value || '--'}</strong>
    </div>
  );
}

function SettingRow({ title, description, onClick, danger = false }) {
  return (
    <button
      type="button"
      className={`mobile-account-page__actionrow${danger ? ' is-danger' : ''}`}
      onClick={onClick}
    >
      <div className="mobile-account-page__actioncopy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <i>{'>'}</i>
    </button>
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
        <div
          className="main-container mobile-account-page"
          style={{ backgroundImage: `url(${images.background5})` }}
        >
          <div
            className="mobile-account-page__scroll"
            style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}
          >
            <Spin />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <div
        className="main-container mobile-account-page"
        style={{ backgroundImage: `url(${images.background5})` }}
      >
        <div className="mobile-account-page__scroll">
          <header className="mobile-account-page__header">
            <button
              type="button"
              className="mobile-account-page__backbutton"
              onClick={() => navigate('/mobile/main')}
            >
              <img alt="back" src={images.icon_back} />
            </button>
            <div className="mobile-account-page__titleblock">
              <span>Account Center</span>
              <strong>账号管理</strong>
            </div>
            <MobileHeaderAction label="角色" onClick={() => navigate('/mobile/mepage')} />
          </header>

          <section className="mobile-account-page__hero">
            <span className="mobile-account-page__eyebrow">账号信息</span>
            <h1>{userInfo.user_name || '未命名用户'}</h1>
            <div className="mobile-account-page__metarow">
              <span>ID {userInfo.user_id || '--'}</span>
              <span>{userInfo.user_phone ? '手机已绑定' : '手机未绑定'}</span>
              <span>{userInfo.user_email ? '邮箱已绑定' : '邮箱未绑定'}</span>
            </div>
          </section>

          <section className="mobile-account-page__section">
            <div className="mobile-account-page__sectionhead">
              <strong>账户详情</strong>
              <span>基础资料</span>
            </div>
            <div className="mobile-account-page__detailpanel">
              <AccountDetailItem label="用户名" value={userInfo.user_name} />
              <AccountDetailItem label="用户 ID" value={userInfo.user_id} />
              <AccountDetailItem label="邮箱" value={userInfo.user_email} />
              <AccountDetailItem label="手机" value={userInfo.user_phone} />
            </div>
          </section>

          <section className="mobile-account-page__section">
            <div className="mobile-account-page__sectionhead">
              <strong>快捷操作</strong>
              <span>账号与系统</span>
            </div>
            <div className="mobile-account-page__actionpanel">
              <SettingRow
                title="修改账号信息"
                description="编辑用户名、邮箱和手机号"
                onClick={() => setEditing(true)}
              />
              <SettingRow
                title="关于"
                description="查看当前版本信息"
                onClick={() => Modal.info({ title: '关于', content: 'AI Dreamroom Beta 0.9.2' })}
              />
              <SettingRow
                title="注销账号"
                description="清除本机登录状态并返回登录页"
                onClick={logout}
                danger
              />
            </div>
          </section>
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
