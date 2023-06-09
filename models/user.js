'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class user extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.user.hasMany(models.entry)
    }
  }
  user.init({
    first_name: DataTypes.TEXT,
    last_name: DataTypes.TEXT,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    template: DataTypes.JSONB,
    current_streak: DataTypes.INTEGER,
    longest_streak: DataTypes.INTEGER,
    commitment: DataTypes.JSONB,
    img: DataTypes.TEXT,
    timezone: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'user',
  });
  return user;
};