import React, { useState } from 'react';

interface HeaderBannerProps {
    title: string;
    subtitle?: string;
    logoLightSrc: string;
    logoDarkSrc: string;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

function HeaderBanner({
    title,
    subtitle,
    logoLightSrc,
    logoDarkSrc,
    theme,
    onToggleTheme,
}: HeaderBannerProps) {
    const [logoFailed, setLogoFailed] = useState<boolean>(false);
    const logoSrc = theme === 'dark' ? logoLightSrc : logoDarkSrc;

    return (
        <header className="app-banner">
            <div className="banner-brand">
                {!logoFailed ? (
                    <img
                        className="brand-logo"
                        src={logoSrc}
                        alt="MIL"
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <div className="brand-fallback">MIL</div>
                )}
                <div className="brand-text">
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
            </div>
            <div className="banner-actions">
                <button className="ghost-button" onClick={onToggleTheme}>
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
            </div>
        </header>
    );
}

export default HeaderBanner;
