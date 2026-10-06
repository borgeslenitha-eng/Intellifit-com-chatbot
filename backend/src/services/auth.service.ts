import bcrypt from "bcrypt";
import { UserRepository } from "../repositories/user.repository";
import jwt from "jsonwebtoken";

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  public async register(name: string, email: string, password: string) {
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 150
    ) {
      throw new Error("Nome, e-mail e senha são obrigatórios.");
    }

    email = email.trim().toLowerCase();
    name = name.trim();
    if (password.length < 6 || Buffer.byteLength(password) > 72) {
      throw new Error(
        "A senha deve possuir pelo menos 6 caracteres e no máximo 72 bytes.",
      );
    }

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new Error("E-mail já cadastrado.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepository.create(name, email, hashedPassword);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  public async login(email: string, password: string) {
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password ||
      Buffer.byteLength(password) > 72
    ) {
      throw new Error("E-mail e senha são obrigatórios.");
    }

    const user = await this.userRepository.findByEmail(
      email.trim().toLowerCase(),
    );

    if (!user) {
      throw new Error("E-mail ou senha inválidos.");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new Error("E-mail ou senha inválidos.");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d",
      },
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }
}
