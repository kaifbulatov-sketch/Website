// Озвучка уроков: путь к файлу и его точная длительность в секундах.
//
// Здесь только ссылки. Сами mp3 лежат в private/audio/ — эта папка в .gitignore,
// потому что одна озвучка урока весит около семи мегабайт, а двадцать восемь
// уроков — это двести мегабайт бинарников в репозитории. Git для такого не нужен:
// на прод файлы поедут в Supabase Storage, и тогда здесь поменяются только пути.
//
// Длительность записана рядом не для красоты: по ней считается, сколько держать
// каждый слайд (см. lesson-video.html). Брать её из самого файла нельзя — на момент
// расчёта таймлайна метаданные ещё не загружены.
//
// Как добавить урок: сгенерировать озвучку по тексту из полей voice в
// course-content.js, положить файл в private/audio/ и вписать строку сюда.
const LESSON_AUDIO = {
  1: { url: 'private/audio/urok-01.mp3', sec: 376.056 },
  2: { url: 'private/audio/urok-02.mp3', sec: 134.856 },
  3: { url: 'private/audio/urok-03.mp3', sec: 120.696 },
  4: { url: 'private/audio/urok-04.mp3', sec: 145.008 },
  5: { url: 'private/audio/urok-05.mp3', sec: 154.536 },
  6: { url: 'private/audio/urok-06.mp3', sec: 130.224 },
  7: { url: 'private/audio/urok-07.mp3', sec: 110.928 },
  8: { url: 'private/audio/urok-08.mp3', sec: 119.496 },
  9: { url: 'private/audio/urok-09.mp3', sec: 104.208 },
  10: { url: 'private/audio/urok-10.mp3', sec: 74.616 },
  11: { url: 'private/audio/urok-11.mp3', sec: 71.088 },
  12: { url: 'private/audio/urok-12.mp3', sec: 86.928 },
  13: { url: 'private/audio/urok-13.mp3', sec: 52.608 },
  14: { url: 'private/audio/urok-14.mp3', sec: 65.424 }
};
