const ErrorCode = {
    EmailCodeError: 0,
    PasswordError: 1,
    EmailNotExist: 2,
    EmailExist: 3,
    PhoneCodeTimeLimit: 4,
    PhoneCodeSendFailed: 5,
    PhoneCodeError: 6,
    WaitlistNotExist: 7,
    WaitlistStatusZero: 8
}

export const ErrorMessage = {
    [ErrorCode.EmailCodeError]: '邮箱验证码错误',
    [ErrorCode.PasswordError]: '用户名或密码错误',
    [ErrorCode.EmailNotExist]: '邮箱不存在，请检查后重新输入',
    [ErrorCode.EmailExist]: '邮箱已存在，请检查后重新输入',
    [ErrorCode.PhoneCodeTimeLimit]: '请间隔一分钟后重新发送验证码',
    [ErrorCode.PhoneCodeSendFailed]: '验证码发送失败，请稍后重试',
    [ErrorCode.PhoneCodeError]: '手机验证码错误',
    [ErrorCode.WaitlistNotExist]: '等待列表中找不到您的账号，请确认您是否已报名。',
    [ErrorCode.WaitlistStatusZero]: '您的账号还在排队等待中，请耐心等待注册名额开放。',
}
