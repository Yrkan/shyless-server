const { Router } = require("express");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("config");
const mongoose = require("mongoose");

const {
  INTERNAL_SERVER_ERROR,
  UNAUTHORIZED_ACCESS,
  INVALID_CREDENTIALS,
  INVALID_TOKEN,
} = require("../../../consts/errors");
const { authAdmin, authUser } = require("../../../middlewears/auth");
const Admin = require("../../../models/Admin");
const User = require("../../../models/User");
const router = Router();

// @Endpoint:     GET   /api/v1/auth/admin
// @Description   Get authentificated admin
// @Access        Private (admin)
router.get("/admin", authAdmin, async (req, res) => {
  try {
    // validate the admin id
    if (!mongoose.Types.ObjectId.isValid(req.admin.id)) {
      return res.status(400).json(INVALID_TOKEN);
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(401).json(UNAUTHORIZED_ACCESS);
    }
    return res.json(admin);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
});

// @Endpoint:     GET   /api/v1/auth/user
// @Description   Get authentificated user
// @Access        Private
router.get("/user", authUser, async (req, res) => {
  try {
    // validate the user id
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json(INVALID_TOKEN);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json(UNAUTHORIZED_ACCESS);
    }
    return res.json(user);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
});

// @Endpoint:     POST   /api/v1/auth/admin/login
// @Description   Login admin
// @Access        Public
router.post(
  "/admin/login",
  [
    // TODO: Better validation
    check("username", "Invalid username").notEmpty().isString(),
    check("password", "Invalid password").notEmpty().isString(),
  ],
  async (req, res) => {
    try {
      // Check bad request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ errors: errors.array({ onlyFirstError: true }) });
      }

      const { username, password } = req.body;
      // Search Database for username
      let admin = await Admin.findOne({ username }).select("+password");
      if (!admin) {
        return res.status(400).json(INVALID_CREDENTIALS);
      }
      // Check if the password is correct
      if (!(await bcrypt.compare(password, admin.password))) {
        return res.status(400).json(INVALID_CREDENTIALS);
      }
      // Correct send a token
      jwt.sign(
        { admin: { id: admin.id } },
        config.get("jwtKey"),
        { expiresIn: 36000 },
        (err, token) => {
          if (err) throw err;
          return res.json(token);
        }
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json(INTERNAL_SERVER_ERROR);
    }
  }
);

// @Endpoint:     POST   /api/v1/auth/user/login
// @Description   Login user
// @Access        Public
router.post(
  "/user/login",
  [
    // TODO: Better validation
    check("username", "Invalid username").isString().notEmpty(),
    check("password", "Invalid password").isString().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ errors: errors.array({ onlyFirstError: true }) });
      }

      const { username, password } = req.body;
      const user = await User.findOne({ username }).select("+password");
      // CHeck if username exists
      if (!user) {
        return res.status(400).json(INVALID_CREDENTIALS);
      }

      //check if password is correct
      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(400).json(INVALID_CREDENTIALS);
      }

      // logged in generate token
      jwt.sign(
        { user: { id: user.id } },
        config.get("jwtKey"),
        {
          expiresIn: 36000,
        },
        (err, token) => {
          if (err) throw err;
          return res.json(token);
        }
      );
    } catch (err) {
      console.error(err.message);
      return res.status(500).json(INTERNAL_SERVER_ERROR);
    }
  }
);
module.exports = router;
