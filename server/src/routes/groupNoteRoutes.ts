import { Router } from 'express';
import * as note from '../controllers/groupNoteController';
import { authenticate, validate } from '../middleware';
import { createNoteSchema, updateNoteSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/:groupId/notes', note.getNotes);
router.post('/:groupId/notes', validate({ body: createNoteSchema }), note.createNote);
router.patch('/:groupId/notes/:noteId', validate({ body: updateNoteSchema }), note.updateNote);
router.patch('/:groupId/notes/:noteId/pin', note.togglePin);
router.delete('/:groupId/notes/:noteId', note.deleteNote);

export default router;
