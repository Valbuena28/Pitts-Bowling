const express = require('express');
const router = express.Router();
const postsController = require('../controllers/posts');
const { authRequired, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Middleware para subir archivos

// Rutas de administración (protegidas)
router.get('/admin', authRequired, adminOnly, postsController.getAdminPosts); // Listado completo para admin
router.get('/admin/:id', authRequired, adminOnly, postsController.getPostById); // Obtener noticia por ID para editar

// Rutas públicas
router.get('/', postsController.getPosts);
router.get('/:slug', postsController.getPostBySlug);

router.post('/', authRequired, adminOnly, upload.fields([{ name: 'main_image', maxCount: 1 }, { name: 'carousel_images', maxCount: 10 }]), postsController.createPost);
router.put('/:id', authRequired, adminOnly, upload.fields([{ name: 'main_image', maxCount: 1 }, { name: 'carousel_images', maxCount: 10 }]), postsController.updatePost);
router.delete('/:id', authRequired, adminOnly, postsController.deletePost);

module.exports = router;
