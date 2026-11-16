import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface TripDateStepProps {
  initialDate?: string;
  onContinue: (dateIso: string, formattedDate: string) => void;
  theme?: 'dark' | 'light';
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const TripDateStep: React.FC<TripDateStepProps> = ({
  initialDate,
  onContinue,
  theme = 'light'
}) => {
  const isDark = theme === 'dark';

  // Current date
  const today = useMemo(() => new Date(), []);
  
  // Selected date state
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate) {
      const d = new Date(initialDate);
      if (!isNaN(d.getTime())) return d;
    }
    // Default to upcoming weekend or tomorrow
    const nextDay = new Date();
    nextDay.setDate(today.getDate() + 1);
    return nextDay;
  });

  // Current viewing month and year
  const [currentMonth, setCurrentMonth] = useState<number>(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(selectedDate.getFullYear());

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = currentMonth === 0 ? 11 : currentMonth - 1;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateObj = new Date(y, m, d);
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        isPast: dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        isToday: false,
        isSelected: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday =
        today.getDate() === d &&
        today.getMonth() === currentMonth &&
        today.getFullYear() === currentYear;
      const isSelected =
        selectedDate.getDate() === d &&
        selectedDate.getMonth() === currentMonth &&
        selectedDate.getFullYear() === currentYear;

      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        isPast,
        isToday,
        isSelected
      });
    }

    // Next month padding to complete 42 or 35 grid
    const totalFilled = days.length;
    const remaining = 35 - totalFilled > 0 ? 35 - totalFilled : 42 - totalFilled;
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        isPast: false,
        isToday: false,
        isSelected: false
      });
    }

    return days;
  }, [currentYear, currentMonth, selectedDate, today]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number, month: number, year: number, isPast: boolean) => {
    if (isPast) return;
    const newDate = new Date(year, month, day);
    setSelectedDate(newDate);
  };

  const formattedSelectedDate = useMemo(() => {
    const weekday = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const day = selectedDate.getDate();
    const month = MONTH_NAMES[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${capitalizedWeekday}, ${day} de ${month} de ${year}`;
  }, [selectedDate]);

  const handleContinue = () => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const isoString = `${y}-${m}-${d}`;
    onContinue(isoString, formattedSelectedDate);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto flex flex-col items-center my-auto px-2 sm:px-4 py-2 sm:py-4"
    >
      {/* Header Titles */}
      <div className="text-center mb-3 sm:mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug">
          Quando você vai para Campos do Jordão?
        </h1>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mt-1 sm:mt-2 font-bold">
          Escolha a data da sua viagem.
        </p>
      </div>

      {/* iOS Minimalist Calendar Card */}
      <div
        className={`w-full p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] transition-all duration-200 ${
          isDark
            ? 'bg-[#1C1C1E] backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
            : 'bg-white/90 backdrop-blur-2xl border border-black/8 shadow-[0_15px_40px_rgba(0,0,0,0.08)]'
        }`}
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-1">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-zinc-900 dark:text-white" />
            <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
              }`}
              title="Mês anterior"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              onClick={handleNextMonth}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
              }`}
              title="Próximo mês"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Weekday Row */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1 sm:mb-2">
          {WEEKDAY_NAMES.map((name, idx) => (
            <div
              key={idx}
              className="text-xs font-black text-zinc-400 dark:text-zinc-500 py-0.5 sm:py-1"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {calendarDays.map((item, idx) => {
            const isClickable = item.isCurrentMonth && !item.isPast;

            return (
              <div key={idx} className="aspect-square flex items-center justify-center p-0.5">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => handleSelectDay(item.day, item.month, item.year, item.isPast)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-black transition-all relative ${
                    item.isSelected
                      ? isDark
                        ? 'bg-white text-black font-black shadow-md scale-105'
                        : 'bg-zinc-900 text-white font-black shadow-md scale-105'
                      : item.isPast
                      ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-40 font-semibold'
                      : !item.isCurrentMonth
                      ? 'text-zinc-300 dark:text-zinc-700 opacity-25 cursor-not-allowed font-semibold'
                      : isDark
                      ? 'text-zinc-100 hover:bg-white/10 active:scale-95 cursor-pointer font-bold'
                      : 'text-zinc-800 hover:bg-zinc-100 active:scale-95 cursor-pointer font-bold'
                  }`}
                >
                  {item.day}
                  {item.isToday && !item.isSelected && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Selected Date Summary Tag */}
        <div
          className={`mt-3.5 pt-3 border-t text-center ${
            isDark ? 'border-white/10' : 'border-zinc-100'
          }`}
        >
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-black block mb-0.5">
            Data Escolhida
          </span>
          <p className="text-sm font-black text-zinc-900 dark:text-white">
            {formattedSelectedDate}
          </p>
        </div>
      </div>

      {/* Primary Action Button: [Continuar] */}
      <div className="w-full mt-4 sm:mt-5">
        <button
          id="btn-itinerary-date-continue"
          type="button"
          onClick={handleContinue}
          className="w-full py-3.5 sm:py-4 px-6 rounded-full expo-liquid-glass-btn text-black dark:text-white border border-black/5 active:scale-95 font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-zinc-50"
        >
          Continuar
        </button>
      </div>
    </motion.div>
  );
};
