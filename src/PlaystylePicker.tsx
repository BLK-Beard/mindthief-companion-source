import {styles,styleNames} from './mindthiefBuilds';
import type {Style} from './mindthiefBuilds';
export default function PlaystylePicker({style,secondary,onChange}:{style:Style;secondary:Style|null;onChange:(style:Style,secondary:Style|null)=>void}) {
 const toggle=(next:Style)=>{if(next===secondary)onChange(style,null);else if(next===style){if(secondary)onChange(secondary,null);}else onChange(style,next);};
 return <><div className="filters" role="group" aria-label="Playstyles · choose up to two">{styles.map(s=><button key={s} className={s===style||s===secondary?'chip selected':'chip'} aria-pressed={s===style||s===secondary} onClick={()=>toggle(s)}>{styleNames[s]}</button>)}</div><p className="guide-footnote">Select two styles for a hybrid. Tap a highlighted style to return to one.</p></>;
}
