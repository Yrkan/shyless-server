const { Router } = require("express");
const { check, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const {
  INTERNAL_SERVER_ERROR,
  USERNAME_ALREADY_IN_USE,
  EMAIL_ALREADY_IN_USE,
  EMAIL_ALREADY_CONFIRMED,
  INVALID_ID,
  INVALID_TOKEN,
  UNAUTHORIZED_ACCESS,
  NOT_FOUND,
} = require("../../../consts/errors");
const {
  USER_REGISTRED_SUCCESSFULLY,
  EMAIL_CONFIRMED_SUCCESSFULLY,
  USER_CREATED_SUCCESSFULLY,
} = require("../../../consts/messages");
const { authAdmin, authAdminOrUser } = require("../../../middlewears/auth");
const Admin = require("../../../models/Admin");
const router = Router();

const User = require("../../../models/User");
const { cryptPassword } = require("../../../utils/crypto");
const { generateEmailVerificationToken } = require("../../../utils/email");

// @Endpoint:     GET   /api/v1/users/
// @Description   Get a list of users
// @Access        Private (superAdmin + manage_users Admins)
router.get("/", authAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    // Verify admin exists
    if (!admin) {
      return res.status(401).json(UNAUTHORIZED_ACCESS);
    }
    // Verify admin's persmissions
    if (!(admin.permissions.super_admin || admin.permissions.manage_users)) {
      return res.status(401).json(UNAUTHORIZED_ACCESS);
    }

    const usersList = await User.find({});
    return res.json(usersList);
  } catch (err) {
    console.error(err);
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
});

// @Endpoint:     GET   /api/v1/users/:id
// @Description   Get a single user full informations
// @Access        Private (superAdmin + manage_uses Admins + Own user)
router.get("/:id", authAdminOrUser, async (req, res) => {
  try {
    // validate the user id
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(INVALID_ID);
    }

    if (!(req.admin || req.user)) {
      return res.status(401).json(UNAUTHORIZED_ACCESS);
    }

    if (req.admin) {
      const admin = await Admin.findById(req.admin.id);
      // Verify admin exists
      if (!admin) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }

      // check admin persmissions
      if (!(admin.permissions.super_admin || admin.permissions.manage_users)) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }
    } else if (req.user) {
      // check the user is the owner of the account
      if (req.user.id != req.params.id) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(400).json(INVALID_TOKEN);
    }

    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
});

// @Endpoint:     GET   /api/v1/users/profile/:username
// @Description   Get a single user profile
// @Access        Public
router.get("/profile/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    if (!user || user.ban_status.is_banned || !user.settings.is_viewable) {
      return res.status(404).json(NOT_FOUND);
    }

    const profile = {
      username: user.username,
      profile_img_url: user.profile_img_url,
      is_askable: user.settings.is_askable,
    };

    return res.json(profile);
  } catch (err) {
    console.error(err);
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
});

// @Endpoint:     POST   /api/v1/users/
// @Description   Create a new user (From admin panel)
// @Access        Private (superAdmin + manage_uses Admins)
router.post(
  "/",
  authAdmin,
  [
    check("username", "username is required").notEmpty(),
    check("password", "password is required").notEmpty(),
    check("email", "email is required").notEmpty(),
    check("email", "invaldie email").isEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(errors.array());
      }

      const loggedAdmin = await Admin.findById(req.admin.id);

      // check admin persmissions
      if (
        !(
          loggedAdmin.permissions.super_admin ||
          loggedAdmin.permissions.manage_users
        )
      ) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }
      const { username, password, email } = req.body;

      // Verify that username and email aren't already in use
      if (await User.findOne({ username })) {
        return res.status(400).json(USERNAME_ALREADY_IN_USE);
      } else if (await User.findOne({ email })) {
        return res.status(400).json(EMAIL_ALREADY_IN_USE);
      }

      // hash password
      hashedpassword = await cryptPassword(password);
      // Initiate the new user
      const user = new User({
        username,
        password: hashedpassword,
        email,
      });
      // set confirmation token
      user.email_confirmation_token = generateEmailVerificationToken(user.id);
      // save user
      await user.save();

      return res.json(USER_CREATED_SUCCESSFULLY);
    } catch (err) {
      console.error(err);
      return res.status(500).json(INTERNAL_SERVER_ERROR);
    }
  }
);

// @Endpoint:     POST   /api/v1/users/register
// @Description   Register a new user
// @Access        Public
router.post(
  "/register",
  [
    check("username", "username is required").notEmpty(),
    check("password", "password is required").notEmpty(),
    check("email", "email is required").notEmpty(),
    check("email", "invaldie email").isEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(errors.array());
      }

      const { username, password, email } = req.body;

      // Verify that username and email aren't already in use
      if (await User.findOne({ username })) {
        return res.status(400).json(USERNAME_ALREADY_IN_USE);
      } else if (await User.findOne({ email })) {
        return res.status(400).json(EMAIL_ALREADY_IN_USE);
      }

      // hash password
      hashedpassword = await cryptPassword(password);
      // Initiate the new user
      const user = new User({
        username,
        password: hashedpassword,
        email,
      });
      // set confirmation token
      user.email_confirmation_token = generateEmailVerificationToken(user.id);
      // save user
      await user.save();

      return res.json(USER_REGISTRED_SUCCESSFULLY);
    } catch (err) {
      console.error(err);
      return res.status(500).json(INTERNAL_SERVER_ERROR);
    }
  }
);

// @Endpoint:     POST   /api/v1/users/register
// @Description   Validate a user
// @Access        Public
router.post(
  "/verify/:id",
  [check("token", "token is required").notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(errors.array());
      }

      // validate the user id
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json(INVALID_ID);
      }

      const { token } = req.body;

      const user = await User.findById(req.params.id).select(
        "+email_confirmation_token"
      );

      // user id doesn't exist
      if (!user) {
        return res.status(400).json(INVALID_ID);
      }

      // user email already verified
      if (user.is_email_confirmed) {
        return res.status(400).json(EMAIL_ALREADY_CONFIRMED);
      }

      // user exists but bad token
      if (user.email_confirmation_token != token) {
        return res.status(401).json(INVALID_TOKEN);
      }

      // user exists and good token => verify user
      user.is_email_confirmed = true; // set confirmed
      user.email_confirmation_token = ""; // clear email confirmation

      await user.save();
      return res.json(EMAIL_CONFIRMED_SUCCESSFULLY);
    } catch (err) {
      console.error(err);
      return res.status(500).json(INTERNAL_SERVER_ERROR);
    }
  }
);

// @Endpoint:     PUT   /api/v1/users/:id
// @Description   Update a user informations
// @Access        Private (superAdmin + manage_uses Admins + Own user (LIMITED))
router.put(
  "/:id",
  authAdminOrUser,
  [
    //TODO: better validation
    check("username", "username is required").notEmpty().optional(),
    check("password", "password is required").notEmpty().optional(),
    check("email", "email is required").notEmpty().optional(),
    check("email", "invalid email address").isEmail().optional(),
    check("profile_img_url", "Invalid image url").isURL().optional(),
  ],
  async (req, res) => {
    try {
      // check for errors in request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // validate the id
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json(INVALID_TOKEN);
      }

      // check if the requested USER exists
      if (!(await User.findById(req.params.id))) {
        return res.status(400).json(INVALID_ID);
      }

      // verify access permission
      if (!(req.admin || req.user)) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }

      if (req.admin) {
        const admin = await Admin.findById(req.admin.id);
        // Verify admin exists
        if (!admin) {
          return res.status(401).json(UNAUTHORIZED_ACCESS);
        }

        // check admin persmissions
        if (
          !(admin.permissions.super_admin || admin.permissions.manage_users)
        ) {
          return res.status(401).json(UNAUTHORIZED_ACCESS);
        }
      } else if (req.user) {
        // check the user is the owner of the account
        if (req.user.id != req.params.id) {
          return res.status(401).json(UNAUTHORIZED_ACCESS);
        }
      }

      // update the user
      const {
        username,
        password,
        email,
        profile_img_url,
        ban_status,
        settings,
      } = req.body;
      const updates = {};

      if (username) {
        // make sure  username doesn't  exist already
        if (await User.findOne({ username })) {
          return res.status(400).json(USERNAME_ALREADY_IN_USE);
        }
        updates.username = username;
      }

      if (email) {
        // make sure  email doesn't  exist already
        if (await Admin.findOne({ email })) {
          return res.status(400).json(EMAIL_ALREADY_IN_USE);
        }
        updates.email = email;
        // set email to unverified and generate confirmation token
        updates.is_email_confirmed = false;
        updates.email_confirmation_token = generateEmailVerificationToken(
          req.params.id
        );
      }

      if (password) {
        const hashedPassword = await cryptPassword(password);
        updates.password = hashedPassword;
      }

      if (profile_img_url) {
        updates.profile_img_url = profile_img_url;
      }

      if (settings) {
        const newSettings = {};
        if (settings.is_askable) {
          newSettings.is_askable = settings.is_askable;
        }
        if (settings.is_viewable) {
          newSettings.is_viewable = settings.is_viewable;
        }
        updates.settings = newSettings;
      }

      if (ban_status) {
        // ban status can be set only by admins
        if (!req.admin) {
          return res.status(401).json(UNAUTHORIZED_ACCESS);
        }
        const newBanStatus = {};
        if (ban_status.is_banned === false) {
          newBanStatus.is_banned = false;
          newBanStatus.banned_by = null;
          newBanStatus.ban_date = null;
        } else {
          newBanStatus.is_banned = true;
          newBanStatus.banned_by = req.admin.id;
          newBanStatus.ban_date = Date.now();
        }
        updates.ban_status = newBanStatus;
      }

      // update the user
      const newUserInfo = await User.findByIdAndUpdate(req.params.id, updates, {
        new: true,
      });

      return res.json(newUserInfo);
    } catch (err) {
      console.error(err);
      return res.status(500).json(INTERNAL_SERVER_ERROR);
    }
  }
);

// @Endpoint:     DELETE   /api/v1/users/:id
// @Description   Delete a user
// @Access        Private (superAdmin + manage_uses Admins + Own user)
router.delete("/:id", authAdminOrUser, async (req, res) => {
  try {
    // validate the user id
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(INVALID_ID);
    }

    if (!(req.admin || req.user)) {
      return res.status(401).json(UNAUTHORIZED_ACCESS);
    }

    if (req.admin) {
      const admin = await Admin.findById(req.admin.id);
      // Verify admin exists
      if (!admin) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }

      // check admin persmissions
      if (!(admin.permissions.super_admin || admin.permissions.manage_users)) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }
    } else if (req.user) {
      // check the user is the owner of the account
      if (req.user.id != req.params.id) {
        return res.status(401).json(UNAUTHORIZED_ACCESS);
      }
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(400).json(INVALID_TOKEN);
    }

    // Delete the user
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    return res.json(deletedUser);
  } catch (err) {
    console.error(err);
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
});
module.exports = router;
