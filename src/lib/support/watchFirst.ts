import { watchErrors } from './errorLogStore';

/*
  Errors written down from the very start of a run, before the tasks that
  run with no screen are defined: watched only from the screens' layout,
  a task's run, which never reaches it, kept nothing of what went wrong.
*/
watchErrors();
