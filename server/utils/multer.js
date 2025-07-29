const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const allowedFormats = ['jpg', 'jpeg', 'png']; // Only images
const maxSize = 5 * 1024 * 1024; // 5MB

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'general';
    if (req.baseUrl.includes('users')) folder = 'profile_pics';
    if (req.baseUrl.includes('travel')) folder = 'travel_docs';
    if (req.baseUrl.includes('expense')) folder = 'expense_docs';
    return {
      folder,
      resource_type: 'image',
      format: file.mimetype.split('/')[1],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const ext = file.mimetype.split('/')[1];
  if (allowedFormats.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, and PNG image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSize },
});

module.exports = upload; 