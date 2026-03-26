using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Data;

/// <summary>
/// EnsureCreated ile oluşmuş mevcut veritabanlarına yeni sütun ekler (migration yerine).
/// </summary>
public static class SchemaPatches
{
    public static async Task ApplyExamResultWrongQuestionsColumnAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (db.Database.IsSqlite())
        {
            var conn = db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync(ct);

            await using var checkCmd = conn.CreateCommand();
            checkCmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info('ExamResults') WHERE name='WrongQuestionsJson'";
            var exists = Convert.ToInt64(await checkCmd.ExecuteScalarAsync(ct)) > 0;
            if (!exists)
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE ExamResults ADD COLUMN WrongQuestionsJson TEXT NOT NULL DEFAULT '[]'",
                    cancellationToken: ct);
            }
        }
        else if (db.Database.IsNpgsql())
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                ALTER TABLE "ExamResults" ADD COLUMN IF NOT EXISTS "WrongQuestionsJson" TEXT NOT NULL DEFAULT '[]';
                """,
                cancellationToken: ct);
        }
    }

    public static async Task ApplyExamResultCorrectQuestionsColumnAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (db.Database.IsSqlite())
        {
            var conn = db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync(ct);

            await using var checkCmd = conn.CreateCommand();
            checkCmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info('ExamResults') WHERE name='CorrectQuestionsJson'";
            var exists = Convert.ToInt64(await checkCmd.ExecuteScalarAsync(ct)) > 0;
            if (!exists)
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE ExamResults ADD COLUMN CorrectQuestionsJson TEXT NOT NULL DEFAULT '[]'",
                    cancellationToken: ct);
            }
        }
        else if (db.Database.IsNpgsql())
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                ALTER TABLE "ExamResults" ADD COLUMN IF NOT EXISTS "CorrectQuestionsJson" TEXT NOT NULL DEFAULT '[]';
                """,
                cancellationToken: ct);
        }
    }
}
