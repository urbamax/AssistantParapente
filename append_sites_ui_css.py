import os

css_additions = """
/* --- SITES UI REFACTORED CLASSES --- */
.site-empty-state { text-align: center; padding: 40px 20px; opacity: 0.6; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color); }
.site-empty-icon { font-size: 3rem; color: var(--text-muted); }
.site-empty-text { margin-top: 15px; color: var(--text-secondary); }

.wind-tag { cursor: pointer; transition: transform 0.2s; display: inline-block; }
.wind-tag:hover { transform: scale(1.1); }

.site-type-badge { background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border-color: var(--border-color); font-weight: 600; text-transform: uppercase; }
.site-dist-badge { background: rgba(14,165,233,0.15); border-color: rgba(14,165,233,0.3); color: var(--accent-blue); }

.site-card-header-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; width: 100%; }
.site-info-row { display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px; }
.site-card-title { color: var(--text-main); margin: 0; font-size: 1.15rem; font-weight: 700; }
.site-wind-tags-row { display: flex; gap: 4px; flex-wrap: wrap; }
.copy-coords-btn { background: var(--bg-input); cursor: pointer; }

.ffvl-btn img { width: 14px; height: 14px; border-radius: 2px; }

.timeline-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 500; }
.ranking-timeline { display: flex; gap: 2px; width: 100%; height: 10px; border-radius: var(--radius-pill); overflow: hidden; background: var(--bg-input); border: 1px solid var(--border-color); cursor: pointer; }
.timeline-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 0.7rem; color: var(--text-muted); }
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-color { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }

.creneaux-list { margin-top: 10px; font-size: 0.85rem; }
.creneaux-list.good { color: var(--accent-green); }
.creneaux-list.bad { color: var(--text-muted); opacity: 0.7; }

.site-rich-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-top: 14px; font-size: 0.85rem; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 14px; text-align: left; clear: both; }
.rich-detail-item { padding: 8px 12px; border-radius: 8px; display: flex; align-items: flex-start; gap: 8px; }
.rich-detail-item.default { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
.rich-detail-item.danger { background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.15); grid-column: 1 / -1; }
.rich-detail-item.obs { background: rgba(255,255,255,0.03); border-left: 3px solid var(--accent-blue); grid-column: 1 / -1; }
.rich-detail-item.full-width { grid-column: 1 / -1; }

.rich-detail-icon { font-size: 1.1rem; margin-top: 2px; }
.rich-detail-icon.blue { color: var(--accent-blue); }
.rich-detail-icon.green { color: var(--accent-green); }
.rich-detail-icon.red { color: var(--accent-red); }
.rich-detail-icon.secondary { color: var(--text-secondary); }

.rich-detail-label { display: block; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
.rich-detail-label.muted { color: var(--text-muted); }
.rich-detail-label.red { color: var(--accent-red); }
.rich-detail-value { color: var(--text-main); font-weight: 500; }

.weather-loading { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; opacity: 0.5; background: var(--bg-input); }
"""

with open('/Volumes/maximeurbaniak/TheorieParapente/css/style.css', 'a', encoding='utf-8') as f:
    f.write(css_additions)
print("Added UI css classes")
