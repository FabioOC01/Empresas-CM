import { useState } from 'react';

export default function FilterGroup({ label, children, defaultOpen = true, badge }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="filter-group">
            <button onClick={() => setOpen(o => !o)} className="filter-group-header">
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span className="filter-group-label">{label}</span>
                    {badge != null && <span className="filter-group-badge">{badge}</span>}
                </span>
                <span className="filter-group-arrow" style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>▼</span>
            </button>
            {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>{children}</div>}
        </div>
    );
}
