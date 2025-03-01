const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    content: {
        type: String,
        default: ''
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    activeUsers: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String,
        lastActive: {
            type: Date,
            default: Date.now
        },
        cursorPosition: Number
    }]
}, {
    timestamps: true,
    _id: false // 禁用自动生成的 ObjectId
});

// 清理不活跃用户的方法
documentSchema.methods.cleanInactiveUsers = function () {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5分钟前
    this.activeUsers = this.activeUsers.filter(user =>
        user.lastActive > fiveMinutesAgo
    );
};

const Document = mongoose.model('Document', documentSchema);

module.exports = Document; 