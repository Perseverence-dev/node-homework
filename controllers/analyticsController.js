// Import the shared Prisma Client.
const prisma = require("../db/prisma");

/**
 * Return task statistics and recent activity for one user.
 */
async function getUserAnalytics(req, res, next) {
  // Express provides route parameters as strings.
  const userId = Number(req.params?.id);

  // The user ID must be a positive whole number.
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      message: "The user ID passed is not valid.",
  });
  }

  try {
    // Verify that the user exists before calculating task statistics.
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    // Return 404 when the requested user does not exist.
    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Count the user's tasks by completion status.
    const taskStats = await prisma.task.groupBy({
      by: ["isCompleted"],
      where: {
        userId,
      },
      _count: {
        id: true,
      },
    });

    // Retrieve the user's ten most recently created tasks.
    const recentTasks = await prisma.task.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
        createdAt: true,
        userId: true,

        // Eagerly load the task owner's name.
        User: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // Calculate the date and time exactly seven days ago.
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Count tasks created during the last seven days,
    // grouping the results by their creation timestamp.
    const weeklyProgress = await prisma.task.groupBy({
      by: ["createdAt"],
      where: {
        userId,
        createdAt: {
          gte: oneWeekAgo,
        },
      },
      _count: {
        id: true,
      },
    });

    // Return the user's task summaries and recent activity.
    return res.status(200).json({
      taskStats,
      recentTasks,
      weeklyProgress,
    });
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Return a paginated list of users with task statistics.
 */
async function getUsersWithStats(req, res, next) {
  // Use default pagination values when page and limit are not provided.
  const page =
    req.query.page === undefined ? 1 : Number(req.query.page);
  const limit =
    req.query.limit === undefined ? 10 : Number(req.query.limit);

  // Page must be a positive whole number.
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({
      message: "Page must be a positive integer.",
    });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: "Limit must be an integer between 1 and 100.",
    });
  }

  // Calculate how many users Prisma should skip.
  const skip = (page - 1) * limit;

  try {
    // Retrieve one page of users, each user's task count,
    // and as many as five incomplete task IDs.
    const usersRaw = await prisma.user.findMany({
      include: {
        Task: {
          where: {
            isCompleted: false,
          },
          select: {
            id: true,
          },
          take: 5,
        },
        _count: {
          select: {
            Task: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Return only safe user fields and the required task statistics.
    // This prevents hashedPassword from being included in the response.
    const users = usersRaw.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      _count: user._count,
      Task: user.Task,
    }));

    // Count all users for the pagination metadata.
    const totalUsers = await prisma.user.count();

    // Build pagination information for the API client.
    const pagination = {
      page,
      limit,
      total: totalUsers,
      pages: Math.ceil(totalUsers / limit),
      hasNext: page * limit < totalUsers,
      hasPrev: page > 1,
    };

    // Return the safe user records and pagination information.
    return res.status(200).json({
      users,
      pagination,
    });
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Search task titles and user names using parameterized raw SQL.
 */
async function searchTasks(req, res, next) {
  // Read and clean the required search query.
  const searchQuery =
    typeof req.query.q === "string" ? req.query.q.trim() : "";

  // The search query must contain at least two characters.
  if (searchQuery.length < 2) {
    return res.status(400).json({
      message: "Search query must be at least 2 characters long.",
    });
  }

  // Use a default result limit of 20 when limit is not provided.
  const limit =
    req.query.limit === undefined ? 20 : Number(req.query.limit);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
      message: "Limit must be an integer between 1 and 100.",
    });
  }

  // Build the three search patterns outside the SQL query.
  const exactMatch = searchQuery;
  const startsWith = `${searchQuery}%`;
  const searchPattern = `%${searchQuery}%`;

  try {
    // Use a parameterized raw SQL query for relevance-ranked searching.
    // Prisma safely sends interpolated values as SQL parameters.
    const results = await prisma.$queryRaw`
      SELECT
        t.id,
        t.title,
        t.is_completed AS "isCompleted",
        t.priority,
        t.created_at AS "createdAt",
        t.user_id AS "userId",
        u.name AS "user_name"
      FROM tasks AS t
      JOIN users AS u
        ON t.user_id = u.id
      WHERE t.title ILIKE ${searchPattern}
         OR u.name ILIKE ${searchPattern}
      ORDER BY
        CASE
          WHEN t.title ILIKE ${exactMatch} THEN 1
          WHEN t.title ILIKE ${startsWith} THEN 2
          WHEN t.title ILIKE ${searchPattern} THEN 3
          ELSE 4
        END,
        t.created_at DESC
      LIMIT ${limit}
    `;

    // Return the matching records and search metadata.
    return res.status(200).json({
      results,
      query: searchQuery,
      count: results.length,
    });
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

// Export the analytics controller functions for use by the analytics router.
module.exports = {
  getUserAnalytics,
  getUsersWithStats,
  searchTasks,
};