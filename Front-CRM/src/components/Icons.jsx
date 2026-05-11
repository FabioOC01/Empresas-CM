const svgProps = (size, props) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
});

export function DashboardIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M4 13h4v7H4zM10 4h4v16h-4zM16 9h4v11h-4z" />
        </svg>
    );
}

export function TeamIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M17 10a3 3 0 1 0 0-6" />
            <path d="M18 20a5 5 0 0 0-2.2-4.1" />
        </svg>
    );
}

export function ClipboardIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <rect x="5" y="4" width="14" height="17" rx="2" />
            <path d="M9 4.5A2 2 0 0 1 11 3h2a2 2 0 0 1 2 1.5V6H9z" />
            <path d="M8.5 11h7M8.5 15h5" />
        </svg>
    );
}

export function BuildingIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
            <path d="M3 21h18M8 8h1M12 8h1M8 12h1M12 12h1M8 16h1M12 16h1" />
        </svg>
    );
}

export function ChartIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M4 19V5" />
            <path d="M4 19h16" />
            <path d="m6.5 15.5 4-4 3 3L19 8" />
        </svg>
    );
}

export function SettingsIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" />
        </svg>
    );
}

export function ClockIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7v5l3.2 2" />
        </svg>
    );
}

export function CalendarIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
    );
}

export function UserIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
    );
}

export function CurrencyIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M14.5 8.5h-3a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-3M12 6.5v11" />
        </svg>
    );
}

export function TagIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M4 12V5h7l9 9-7 7z" />
            <circle cx="8" cy="8" r="1" />
        </svg>
    );
}

export function PipelineIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M4 6h5a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h5" />
            <path d="m17 15 3 3-3 3M4 18h4M4 12h4" />
        </svg>
    );
}

export function LockIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

export function PaletteIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.7 1.7 0 0 1 1.2-2.9H18a3 3 0 0 0 3-3A8.7 8.7 0 0 0 12 3Z" />
            <path d="M7.5 10h.01M10 7h.01M14 7.5h.01M8.5 14h.01" />
        </svg>
    );
}

export function SunIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
    );
}

export function MoonIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
        </svg>
    );
}

export function FileIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M7 3h7l4 4v14H7z" />
            <path d="M14 3v5h5M9.5 13h5M9.5 17h5" />
        </svg>
    );
}

export function ImageIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="m7 16 3-3 2.5 2.5 2-2L18 17" />
            <circle cx="9" cy="9" r="1" />
        </svg>
    );
}

export function PaperclipIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="m9 12 5.5-5.5a3 3 0 1 1 4.2 4.2L11 18.4a5 5 0 0 1-7.1-7.1l7.6-7.6" />
        </svg>
    );
}

export function AlertIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M12 4 3 20h18z" />
            <path d="M12 9v5M12 17h.01" />
        </svg>
    );
}

export function EditIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M15.5 4.5 19.5 8.5 9 19l-5 1 1-5z" />
            <path d="m14 6 4 4" />
        </svg>
    );
}

export function PowerIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="M12 3v8" />
            <path d="M7.2 6.8a7 7 0 1 0 9.6 0" />
        </svg>
    );
}

export function ChevronLeftIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="m15 6-6 6 6 6" />
        </svg>
    );
}

export function ChevronRightIcon({ size = 16, ...props }) {
    return (
        <svg {...svgProps(size, props)}>
            <path d="m9 6 6 6-6 6" />
        </svg>
    );
}
