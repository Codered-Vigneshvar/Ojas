import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface Props {
  date: Date;
  onChange: (newDate: Date) => void;
}

export default function DayPicker({ date, onChange }: Props) {
  const handlePrevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onChange(d);
  };

  const handleNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onChange(d);
  };

  const handleToday = () => {
    onChange(new Date());
  };

  const isToday = new Date().toDateString() === date.toDateString();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-white border border-neutral-200 rounded-lg shadow-sm">
        <button
          onClick={handlePrevDay}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 rounded-l-lg transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="px-3 py-1.5 border-x border-neutral-100 min-w-[140px] text-center flex items-center justify-center gap-2">
          <CalendarIcon size={14} className="text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 select-none">
            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <button
          onClick={handleNextDay}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 rounded-r-lg transition-colors"
          aria-label="Next day"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {!isToday && (
        <button
          onClick={handleToday}
          className="px-3 py-1.5 text-xs font-medium text-neutral-500 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-800 rounded-lg transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
}
