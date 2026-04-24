const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage para fotos de perfil (resize automático 200x200, centrado en cara)
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'crm/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
    },
});

// Storage para adjuntos de actividades (PDF, imágenes, docs)
const docStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'crm/documentos',
        allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xlsx', 'docx'],
        resource_type: 'auto',
    },
});

module.exports = {
    cloudinary,
    uploadAvatar: multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } }),
    uploadDoc:    multer({ storage: docStorage,    limits: { fileSize: 20 * 1024 * 1024 } }),
};
